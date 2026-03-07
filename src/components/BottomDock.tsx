import { PropsWithChildren } from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { theme } from '@/src/constants/theme';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
}>;

export function BottomDock({ children, style }: Props) {
  return <View style={[styles.dock, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  dock: {
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: '#2A1F3566',
    backgroundColor: '#08050DEE',
    shadowColor: '#02020D',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
