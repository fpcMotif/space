// react-native-macos adds a handful of macOS-only props (Flow-typed in its
// own source) that the plain `react-native` TypeScript types don't know
// about. Augment just the ones this app uses.
import 'react-native';

declare module 'react-native' {
  interface HandledKeyEvent {
    key: string;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    shiftKey?: boolean;
  }

  interface KeyEvent {
    nativeEvent: { key: string };
  }

  interface ViewProps {
    onDoubleClick?: (event: unknown) => void;
    keyDownEvents?: HandledKeyEvent[];
    onKeyDown?: (event: KeyEvent) => void;
  }

  interface PressableProps {
    keyDownEvents?: HandledKeyEvent[];
    onKeyDown?: (event: KeyEvent) => void;
  }
}
