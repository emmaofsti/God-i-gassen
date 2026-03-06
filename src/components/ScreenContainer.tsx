import { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '@/src/constants/theme';

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentStyle?: ViewStyle;
}>;

function NeonBackground() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient colors={theme.gradients.background} style={StyleSheet.absoluteFillObject} />
      <View style={[styles.blob, styles.blobTop]} />
      <View style={[styles.blob, styles.blobBottom]} />
      <View style={[styles.blob, styles.blobRight]} />
    </View>
  );
}

export function ScreenContainer({ children, scroll = false, contentStyle }: Props) {
  const insets = useSafeAreaInsets();
  const verticalPadding = Math.max(insets.bottom, theme.spacing.sm);

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <NeonBackground />
        <KeyboardAvoidingView
          style={styles.keyboardLayer}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: theme.spacing.xl + verticalPadding }, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentInsetAdjustmentBehavior="automatic"
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <NeonBackground />
      <KeyboardAvoidingView
        style={styles.keyboardLayer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.content, { paddingBottom: theme.spacing.md + verticalPadding }, contentStyle]}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardLayer: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    gap: theme.spacing.md,
  },
  blob: {
    position: 'absolute',
    borderRadius: theme.radius.pill,
    opacity: 0.24,
  },
  blobTop: {
    width: 210,
    height: 210,
    backgroundColor: theme.colors.accent,
    top: -90,
    left: -50,
  },
  blobBottom: {
    width: 240,
    height: 240,
    backgroundColor: theme.colors.accentPink,
    bottom: -120,
    left: -40,
  },
  blobRight: {
    width: 200,
    height: 200,
    backgroundColor: theme.colors.accentViolet,
    top: 160,
    right: -120,
  },
});
