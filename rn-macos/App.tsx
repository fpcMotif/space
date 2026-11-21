/**
 * Space — fractal rooms window manager (React Native macOS prototype).
 *
 * @format
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// @ts-ignore -- macOS-only imperative command, not in the public typings.
import { Commands as ViewCommands } from 'react-native/Libraries/Components/View/ViewNativeComponent';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { RoomCanvas } from './src/components/RoomCanvas';
import { layoutTree } from './src/space/layout';
import { pathEqual } from './src/space/paths';
import type { LaidOutNode } from './src/space/types';
import { useSpace } from './src/useSpace';

function App() {
  const space = useSpace();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const rootRef = useRef<React.ElementRef<typeof Pressable>>(null);

  useEffect(() => {
    if (rootRef.current) {
      try {
        ViewCommands.focus(rootRef.current);
      } catch {
        // Older/newer react-native-macos builds may not expose this command;
        // clicking a panel still gives the window key focus either way.
      }
    }
  }, []);

  const nodes: LaidOutNode[] = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) return [];
    return space.layoutFor({ x: 0, y: 0, width: size.width, height: size.height });
  }, [space, size.width, size.height]);

  const handleSize = useCallback((width: number, height: number) => setSize({ width, height }), []);

  const handleWheelZoom = useCallback(
    (direction: 'in' | 'out') => {
      if (direction === 'out') {
        space.zoomOut();
        return;
      }
      // Zoom in toward whatever is currently focused.
      const target = nodes.find(n => pathEqual(n.path, space.focusPath));
      if (target && target !== nodes[0]) space.zoomIn(target.path);
    },
    [nodes, space],
  );

  const handleKeyDown = useCallback(
    (event: { nativeEvent: { key: string } }) => {
      switch (event.nativeEvent.key) {
        case 'h':
        case 'j':
        case 'k':
        case 'l':
          space.moveFocus(event.nativeEvent.key as 'h' | 'j' | 'k' | 'l', nodes);
          break;
        case 'Enter':
          space.zoomIn();
          break;
        case 'Escape':
          space.zoomOut();
          break;
        case '0':
          space.zoomOverview();
          break;
        case 'a':
          space.apply();
          break;
      }
    },
    [nodes, space],
  );

  return (
    <Pressable
      ref={rootRef}
      style={styles.root}
      keyDownEvents={[
        { key: 'h' }, { key: 'j' }, { key: 'k' }, { key: 'l' },
        { key: 'Enter' }, { key: 'Escape' }, { key: '0' }, { key: 'a' },
      ]}
      onKeyDown={handleKeyDown}
    >
      <RoomCanvas
        nodes={nodes}
        zoomKey={space.zoomPath.join('/')}
        focusPath={space.focusPath}
        onSize={handleSize}
        onFocus={space.focus}
        onZoomIn={space.zoomIn}
        onZoomOut={space.zoomOut}
        onWheelZoom={handleWheelZoom}
      />
      <Toolbar
        breadcrumb={space.zoomPath.length === 0 ? 'Overview' : `/${space.zoomPath.join('/')}`}
        source={space.source}
        trusted={space.trusted}
        applying={space.applying}
        applyResult={space.applyResult}
        onApply={space.apply}
        onRequestTrust={space.requestTrust}
      />
    </Pressable>
  );
}

interface ToolbarProps {
  breadcrumb: string;
  source: 'demo' | 'file';
  trusted: boolean | null;
  applying: boolean;
  applyResult: { placed: number; missing: number; at: number } | null;
  onApply: () => void;
  onRequestTrust: () => void;
}

function Toolbar({ breadcrumb, source, trusted, applying, applyResult, onApply, onRequestTrust }: ToolbarProps) {
  return (
    <View style={[styles.toolbar, { pointerEvents: 'box-none' }]}>
      <View style={[styles.toolbarLeft, { pointerEvents: 'none' }]}>
        <Text style={styles.breadcrumb}>{breadcrumb}</Text>
        <Text style={styles.sourceTag}>{source === 'file' ? 'space.json' : 'demo tree'}</Text>
      </View>
      <View style={styles.toolbarRight}>
        {trusted === false ? (
          <Pressable style={styles.trustButton} onPress={onRequestTrust}>
            <Text style={styles.trustButtonText}>Grant Accessibility…</Text>
          </Pressable>
        ) : null}
        {applyResult ? (
          <Text style={styles.applyStatus}>
            {applyResult.placed} placed{applyResult.missing ? `, ${applyResult.missing} missing` : ''}
          </Text>
        ) : null}
        <Pressable style={styles.applyButton} onPress={onApply} disabled={applying}>
          <Text style={styles.applyButtonText}>{applying ? 'Applying…' : 'Apply (a)'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#15161a' },
  toolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(10,10,12,0.85)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  toolbarLeft: { flexDirection: 'row', alignItems: 'baseline' },
  breadcrumb: { color: 'white', fontSize: 12, fontWeight: '600' },
  sourceTag: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginLeft: 8 },
  toolbarRight: { flexDirection: 'row', alignItems: 'center' },
  applyStatus: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginRight: 10 },
  applyButton: { backgroundColor: '#5AC8FA', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  applyButtonText: { color: '#0a0a0c', fontSize: 12, fontWeight: '700' },
  trustButton: { backgroundColor: '#ff9f0a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginRight: 10 },
  trustButtonText: { color: '#0a0a0c', fontSize: 12, fontWeight: '700' },
});

export default App;
