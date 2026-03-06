import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { theme } from '@/src/constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({ title, onPress, disabled = false, style }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.shell,
        disabled && styles.shellDisabled,
        pressed && !disabled && styles.shellPressed,
        style,
      ]}
    >
      <LinearGradient colors={theme.gradients.primaryButton} style={styles.gradient}>
        <Text style={styles.text}>{title}</Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderRadius: theme.radius.md,
    shadowColor: '#24F4ED',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  shellPressed: {
    transform: [{ scale: 0.985 }],
  },
  shellDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
  },
  gradient: {
    borderRadius: theme.radius.md,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
    borderWidth: 1,
    borderColor: '#DFFFFF66',
  },
  text: {
    color: '#05151C',
    fontWeight: '900',
    fontSize: 18,
    letterSpacing: 0.6,
  },
});
