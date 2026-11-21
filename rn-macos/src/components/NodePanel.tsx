import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LaidOutNode } from '../space/types';

interface Props {
  node: LaidOutNode;
  focused: boolean;
  onFocus: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

// Subtle depth cue: deeper nesting gets a slightly lighter tint.
const DEPTH_TINTS = ['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0.11)', 'rgba(255,255,255,0.14)'];

export function NodePanel({ node, focused, onFocus, onZoomIn, onZoomOut }: Props) {
  // A stack shows one card at a time; hidden siblings share the active
  // card's rect and would otherwise paint illegible overlapping text.
  if (node.peeked) return null;

  const { rect, depth } = node;
  const data = node.node;
  const isContainer = Boolean(data.children && data.children.length > 0);
  const isWindow = Boolean(data.window);
  const title = data.name ?? (isWindow ? data.window!.app ?? data.window!.bundleID : undefined);

  return (
    <View
      // A plain View's GestureResponder carries the macOS-only `button`
      // field (0 = left, 2 = right), which is the reliable, non-experimental
      // way to tell a right click from a left one on this RN version.
      onStartShouldSetResponder={() => true}
      onResponderGrant={event => {
        const button = (event.nativeEvent as unknown as { button?: number }).button ?? 0;
        if (button === 2) {
          onZoomOut();
          return;
        }
        onFocus();
      }}
      // Native double-click recognizer, independent of the responder system above.
      onDoubleClick={onZoomIn}
      style={[
        styles.panel,
        {
          left: rect.x,
          top: rect.y,
          width: rect.width,
          height: rect.height,
          backgroundColor: DEPTH_TINTS[Math.min(depth, DEPTH_TINTS.length - 1)],
          borderColor: focused ? '#5AC8FA' : 'rgba(255,255,255,0.16)',
          borderWidth: focused ? 2 : 1,
        },
      ]}
    >
      {title ? (
        <Text style={styles.label} numberOfLines={1}>
          {title}
        </Text>
      ) : null}
      {isWindow && data.window?.title ? (
        <Text style={styles.subtitle} numberOfLines={1}>
          {data.window.title}
        </Text>
      ) : null}
      {!isContainer && !isWindow ? <Text style={styles.empty}>Empty</Text> : null}
      {data.arrange === 'stack' && isContainer ? (
        <View style={[styles.stackDots, { pointerEvents: 'none' }]}>
          {data.children!.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === (data.active ?? 0) && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    borderRadius: 10,
    padding: 10,
    overflow: 'hidden',
  },
  label: { color: 'white', fontSize: 13, fontWeight: '600' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 2 },
  empty: { color: 'rgba(255,255,255,0.3)', fontSize: 11, fontStyle: 'italic' },
  stackDots: { position: 'absolute', top: 8, right: 10, flexDirection: 'row' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.3)', marginLeft: 4 },
  dotActive: { backgroundColor: '#5AC8FA' },
});
