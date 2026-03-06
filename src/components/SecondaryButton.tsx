import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';

import { theme } from '@/src/constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  danger?: boolean;
};

export function SecondaryButton({ title, onPress, style, danger = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        danger && styles.danger,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.text, danger && styles.dangerText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#121A2A99',
    borderColor: '#4B5D8155',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  pressed: {
    opacity: 0.82,
  },
  danger: {
    borderColor: '#FF6B8A55',
    backgroundColor: '#2A131A99',
  },
  text: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.4,
  },
  dangerText: {
    color: '#FF98A9',
  },
});
