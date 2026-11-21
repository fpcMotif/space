import React, { useEffect, useRef } from 'react';
import { Animated, Easing, LayoutChangeEvent, ScrollView, StyleSheet, View } from 'react-native';
import { pathEqual } from '../space/paths';
import type { LaidOutNode } from '../space/types';
import { NodePanel } from './NodePanel';

interface Props {
  nodes: LaidOutNode[];
  zoomKey: string;
  focusPath: number[];
  onSize: (width: number, height: number) => void;
  onFocus: (path: number[]) => void;
  onZoomIn: (path: number[]) => void;
  onZoomOut: () => void;
  /** Scroll (and pinch, via NSScrollView magnification) zoom gestures. */
  onWheelZoom: (direction: 'in' | 'out') => void;
}

const ANIM_MS = 180;
// A whole scroll "tick" or a pinch past this magnification is treated as one
// zoom step; the scroll view is then recentered so the gesture can repeat.
const SCROLL_ZOOM_THRESHOLD = 60;
const PINCH_IN_THRESHOLD = 1.15;
const PINCH_OUT_THRESHOLD = 0.87;

export function RoomCanvas({ nodes, zoomKey, focusPath, onSize, onFocus, onZoomIn, onZoomOut, onWheelZoom }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const anim = useRef(new Animated.Value(1)).current;
  const lastZoomKey = useRef(zoomKey);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    onSize(width, height);
  };

  useEffect(() => {
    if (zoomKey === lastZoomKey.current) return;
    lastZoomKey.current = zoomKey;
    anim.setValue(0.94);
    Animated.timing(anim, {
      toValue: 1,
      duration: ANIM_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [zoomKey, anim]);

  const resetGesture = () => {
    scrollRef.current?.scrollTo({ x: 0, y: 0, animated: false });
  };

  const handleScroll = (e: { nativeEvent: { contentOffset: { x: number; y: number }; zoomScale?: number } }) => {
    const { contentOffset, zoomScale } = e.nativeEvent;
    if (zoomScale != null && zoomScale > PINCH_IN_THRESHOLD) {
      onWheelZoom('in');
      resetGesture();
      return;
    }
    if (zoomScale != null && zoomScale < PINCH_OUT_THRESHOLD) {
      onWheelZoom('out');
      resetGesture();
      return;
    }
    if (contentOffset.y > SCROLL_ZOOM_THRESHOLD) {
      onWheelZoom('in');
      resetGesture();
    } else if (contentOffset.y < -SCROLL_ZOOM_THRESHOLD) {
      onWheelZoom('out');
      resetGesture();
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.fill}
      contentContainerStyle={styles.fill}
      minimumZoomScale={0.5}
      maximumZoomScale={2}
      pinchGestureEnabled
      bounces={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={handleScroll}
    >
      <View style={styles.fill} onLayout={handleLayout}>
        <Animated.View style={[styles.fill, { opacity: anim, transform: [{ scale: anim }] }]}>
          {nodes.map(n => (
            <NodePanel
              key={n.path.join('/')}
              node={n}
              focused={pathEqual(n.path, focusPath)}
              onFocus={() => onFocus(n.path)}
              onZoomIn={() => onZoomIn(n.path)}
              onZoomOut={onZoomOut}
            />
          ))}
        </Animated.View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
