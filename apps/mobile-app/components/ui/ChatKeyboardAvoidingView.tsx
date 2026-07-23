import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, KeyboardAvoidingViewProps, Keyboard, View } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

interface ChatKeyboardAvoidingViewProps extends KeyboardAvoidingViewProps {
  children: React.ReactNode;
  offset?: number;
}

function AndroidKeyboardSpacer() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  return <View style={{ height: keyboardHeight }} />;
}

export function ChatKeyboardAvoidingView({ children, offset = 0, style, ...props }: ChatKeyboardAvoidingViewProps) {
  let headerHeight = 0;
  try {
    headerHeight = useHeaderHeight();
  } catch (e) {
    headerHeight = 0;
  }

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.container, style]} {...props as any}>
        {children}
        <AndroidKeyboardSpacer />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior="padding"
      keyboardVerticalOffset={headerHeight + offset}
      {...props}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
