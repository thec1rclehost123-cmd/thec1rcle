/**
 * React 18/19 type bridge for React Native components.
 *
 * Root node_modules has @types/react@18.x (used by react-native types).
 * This app's local node_modules has @types/react@19.x (used by app code).
 * The ReactPortal/ReactNode definitions are structurally incompatible between
 * the two versions. This augmentation widens children to `any` on affected
 * native components, eliminating the assignability errors without impacting
 * runtime behavior (React Native renders whatever it receives).
 */

// `export {}` makes this a module so `declare module` below is an augmentation
// (not a global override) and the existing module exports are preserved.
export {};

/* eslint-disable @typescript-eslint/no-explicit-any */

declare module 'react-native' {
  interface ViewProps {
    children?: any;
  }
  interface TextProps {
    children?: any;
  }
}

declare module 'react-native' {
  // absoluteFillObject was removed from the RN 0.83 namespace types but exists at runtime
  namespace StyleSheet {
    const absoluteFillObject: {
      position: 'absolute';
      left: 0;
      right: 0;
      bottom: 0;
      top: 0;
    };
  }
}

declare module 'expo-linear-gradient' {
  interface LinearGradientProps {
    children?: any;
  }
}

declare module 'expo-blur' {
  interface BlurViewProps {
    children?: any;
  }
}
