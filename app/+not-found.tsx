import { Link, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/src/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Fant ikke side' }} />
      <View style={styles.container}>
        <Text style={styles.title}>Siden finnes ikke.</Text>
        <Link href="/" style={styles.link}>
          Gå til hjem
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: theme.colors.background,
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  link: {
    marginTop: theme.spacing.md,
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
