// SpaceWindows.m
//
// Native window management for the Space "fractal rooms" prototype: lists
// and arranges real windows on screen through the Accessibility API, and
// reads (never writes) the shared ~/Library/Application Support/Space/space.json
// file. Mirrors the patterns in Sources/Rooms/Windows/AX.swift from the
// Swift menu-bar app this prototype is exploring an alternative front end for.

#import <AppKit/AppKit.h>
#import <ApplicationServices/ApplicationServices.h>
#import <React/RCTBridgeModule.h>
#import <dlfcn.h>

typedef AXError (*SWGetWindowFn)(AXUIElementRef, CGWindowID *);

/// The private `_AXUIElementGetWindow` every macOS window manager uses to get
/// the window-server ID for an AX window. Looked up at runtime so a future
/// macOS without it degrades to returning windowID 0 instead of crashing.
static SWGetWindowFn SWGetWindowFunction(void)
{
    static SWGetWindowFn fn;
    static dispatch_once_t once;
    dispatch_once(&once, ^{
        void *handle = dlopen(NULL, RTLD_NOW);
        if (handle) {
            fn = (SWGetWindowFn)dlsym(handle, "_AXUIElementGetWindow");
        }
    });
    return fn;
}

static CGWindowID SWWindowID(AXUIElementRef element)
{
    SWGetWindowFn fn = SWGetWindowFunction();
    if (!fn) return 0;
    CGWindowID windowID = 0;
    return (fn(element, &windowID) == kAXErrorSuccess) ? windowID : 0;
}

static AXUIElementRef SWAppElement(pid_t pid)
{
    AXUIElementRef element = AXUIElementCreateApplication(pid);
    // A hung app must never freeze the app: the default timeout is ~6s.
    AXUIElementSetMessagingTimeout(element, 0.5);
    return element;
}

static BOOL SWFrame(AXUIElementRef element, CGRect *outFrame)
{
    CFTypeRef positionValue = NULL;
    CFTypeRef sizeValue = NULL;
    if (AXUIElementCopyAttributeValue(element, kAXPositionAttribute, &positionValue) != kAXErrorSuccess || !positionValue) {
        return NO;
    }
    if (AXUIElementCopyAttributeValue(element, kAXSizeAttribute, &sizeValue) != kAXErrorSuccess || !sizeValue) {
        CFRelease(positionValue);
        return NO;
    }
    CGPoint origin = CGPointZero;
    CGSize size = CGSizeZero;
    AXValueGetValue((AXValueRef)positionValue, kAXValueCGPointType, &origin);
    AXValueGetValue((AXValueRef)sizeValue, kAXValueCGSizeType, &size);
    CFRelease(positionValue);
    CFRelease(sizeValue);
    *outFrame = CGRectMake(origin.x, origin.y, size.width, size.height);
    return YES;
}

static void SWSetSize(AXUIElementRef element, CGSize size)
{
    AXValueRef value = AXValueCreate(kAXValueCGSizeType, &size);
    if (value) {
        AXUIElementSetAttributeValue(element, kAXSizeAttribute, value);
        CFRelease(value);
    }
}

static void SWSetPosition(AXUIElementRef element, CGPoint point)
{
    AXValueRef value = AXValueCreate(kAXValueCGPointType, &point);
    if (value) {
        AXUIElementSetAttributeValue(element, kAXPositionAttribute, value);
        CFRelease(value);
    }
}

/// The pid that owns a window number, via the window server (no Accessibility
/// permission needed for this lookup).
static pid_t SWOwnerPID(CGWindowID windowID)
{
    pid_t pid = 0;
    CFArrayRef list = CGWindowListCopyWindowInfo(kCGWindowListOptionAll, kCGNullWindowID);
    if (list) {
        for (NSDictionary *info in (__bridge NSArray *)list) {
            if ([info[(id)kCGWindowNumber] unsignedIntValue] == windowID) {
                pid = [info[(id)kCGWindowOwnerPID] intValue];
                break;
            }
        }
        CFRelease(list);
    }
    return pid;
}

/// Finds the AXUIElement for a window number by scanning its owning app's
/// windows. There is no direct AX lookup by window ID; every macOS window
/// manager resolves it this way. Caller must CFRelease the result.
static AXUIElementRef SWElementForWindowID(CGWindowID windowID)
{
    pid_t pid = SWOwnerPID(windowID);
    if (pid == 0) return NULL;
    AXUIElementRef appElement = SWAppElement(pid);
    CFArrayRef windows = NULL;
    AXUIElementRef found = NULL;
    if (AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute, (CFTypeRef *)&windows) == kAXErrorSuccess && windows) {
        CFIndex count = CFArrayGetCount(windows);
        for (CFIndex i = 0; i < count; i++) {
            AXUIElementRef element = (AXUIElementRef)CFArrayGetValueAtIndex(windows, i);
            if (SWWindowID(element) == windowID) {
                found = element;
                CFRetain(found);
                break;
            }
        }
        CFRelease(windows);
    }
    CFRelease(appElement);
    return found;
}

@interface SpaceWindows : NSObject <RCTBridgeModule>
@end

@implementation SpaceWindows

RCT_EXPORT_MODULE();

+ (BOOL)requiresMainQueueSetup
{
    return NO;
}

RCT_EXPORT_METHOD(isTrusted:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    resolve(@(AXIsProcessTrusted()));
}

RCT_EXPORT_METHOD(requestTrust:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // Shows the system prompt that leads to Privacy & Security > Accessibility.
    NSDictionary *options = @{ (__bridge id)kAXTrustedCheckOptionPrompt: @YES };
    AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)options);
    resolve(@YES);
}

RCT_EXPORT_METHOD(visibleFrame:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    // NSScreen must be read on the main thread.
    dispatch_async(dispatch_get_main_queue(), ^{
        NSArray<NSScreen *> *screens = [NSScreen screens];
        if (screens.count == 0) {
            reject(@"no_screen", @"No screens are connected", nil);
            return;
        }
        CGFloat primaryHeight = screens.firstObject.frame.size.height;
        NSPoint mouse = [NSEvent mouseLocation];
        NSScreen *active = screens.firstObject;
        for (NSScreen *screen in screens) {
            if (NSPointInRect(mouse, screen.frame)) {
                active = screen;
                break;
            }
        }
        NSRect visible = active.visibleFrame;
        // Cocoa screen rects have a bottom-left origin; flip to the AX
        // convention (points, y down, origin top-left of the primary display).
        CGRect ax = CGRectMake(visible.origin.x,
                                primaryHeight - (visible.origin.y + visible.size.height),
                                visible.size.width, visible.size.height);
        resolve(@{
            @"x": @(ax.origin.x), @"y": @(ax.origin.y),
            @"width": @(ax.size.width), @"height": @(ax.size.height),
        });
    });
}

RCT_EXPORT_METHOD(listWindows:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSMutableArray *result = [NSMutableArray array];
    NSRunningApplication *current = [NSRunningApplication currentApplication];
    for (NSRunningApplication *app in [NSWorkspace sharedWorkspace].runningApplications) {
        if (app.activationPolicy != NSApplicationActivationPolicyRegular) continue;
        if ([app isEqual:current]) continue;
        NSString *bundleID = app.bundleIdentifier;
        if (!bundleID) continue;

        AXUIElementRef appElement = SWAppElement(app.processIdentifier);
        CFArrayRef windows = NULL;
        if (AXUIElementCopyAttributeValue(appElement, kAXWindowsAttribute, (CFTypeRef *)&windows) == kAXErrorSuccess && windows) {
            CFIndex count = CFArrayGetCount(windows);
            for (CFIndex i = 0; i < count; i++) {
                AXUIElementRef element = (AXUIElementRef)CFArrayGetValueAtIndex(windows, i);

                CFTypeRef subroleRef = NULL;
                AXUIElementCopyAttributeValue(element, kAXSubroleAttribute, &subroleRef);
                NSString *subrole = subroleRef ? (__bridge_transfer NSString *)subroleRef : nil;
                if (![subrole isEqualToString:(NSString *)kAXStandardWindowSubrole]) continue;

                CGRect frame;
                if (!SWFrame(element, &frame) || frame.size.width < 100 || frame.size.height < 60) continue;

                CFTypeRef titleRef = NULL;
                AXUIElementCopyAttributeValue(element, kAXTitleAttribute, &titleRef);
                NSString *title = titleRef ? (__bridge_transfer NSString *)titleRef : @"";

                CGWindowID windowID = SWWindowID(element);

                [result addObject:@{
                    @"pid": @(app.processIdentifier),
                    @"bundleID": bundleID,
                    @"app": app.localizedName ?: bundleID,
                    @"title": title ?: @"",
                    @"windowID": @(windowID),
                    @"frame": @{
                        @"x": @(frame.origin.x), @"y": @(frame.origin.y),
                        @"width": @(frame.size.width), @"height": @(frame.size.height),
                    },
                }];
            }
            CFRelease(windows);
        }
        CFRelease(appElement);
    }
    resolve(result);
}

RCT_EXPORT_METHOD(setFrame:(nonnull NSNumber *)windowID
                  rect:(NSDictionary *)rect
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    AXUIElementRef element = SWElementForWindowID((CGWindowID)windowID.unsignedIntValue);
    if (!element) {
        resolve(@NO);
        return;
    }
    CGPoint origin = CGPointMake([rect[@"x"] doubleValue], [rect[@"y"] doubleValue]);
    CGSize size = CGSizeMake([rect[@"width"] doubleValue], [rect[@"height"] doubleValue]);
    // Size, then position, then size again: macOS clamps a window's size to
    // the display it is currently on, so a move to another display needs
    // the second resize.
    SWSetSize(element, size);
    SWSetPosition(element, origin);
    SWSetSize(element, size);
    CFRelease(element);
    resolve(@YES);
}

RCT_EXPORT_METHOD(raise:(nonnull NSNumber *)windowID
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    CGWindowID target = (CGWindowID)windowID.unsignedIntValue;
    AXUIElementRef element = SWElementForWindowID(target);
    if (!element) {
        resolve(@NO);
        return;
    }
    AXUIElementPerformAction(element, kAXRaiseAction);
    pid_t pid = SWOwnerPID(target);
    if (pid != 0) {
        NSRunningApplication *app = [NSRunningApplication runningApplicationWithProcessIdentifier:pid];
        [app activateWithOptions:NSApplicationActivateIgnoringOtherApps];
    }
    CFRelease(element);
    resolve(@YES);
}

RCT_EXPORT_METHOD(readSpaceFile:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
    NSString *path = [NSHomeDirectory() stringByAppendingPathComponent:@"Library/Application Support/Space/space.json"];
    NSError *error = nil;
    NSString *contents = [NSString stringWithContentsOfFile:path encoding:NSUTF8StringEncoding error:&error];
    resolve(contents ?: [NSNull null]);
}

@end
