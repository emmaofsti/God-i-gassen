import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import 'react-native-reanimated';

import { GameSessionProvider } from '@/src/context/GameSessionContext';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#050508',
    card: '#050508',
    border: '#2A1F35',
    text: '#F5F0FF',
    primary: '#FF33CC',
    notification: '#FF5D73',
  },
};

export default function RootLayout() {
  return (
    <GameSessionProvider>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#050508' },
            headerTintColor: '#F5F0FF',
            contentStyle: { backgroundColor: '#050508' },
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '800' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="player-setup" options={{ title: 'Spillere' }} />
          <Stack.Screen name="card-game" options={{ title: 'Kortspill' }} />
          <Stack.Screen name="wheel-game" options={{ title: 'Spin The Wheel' }} />
          <Stack.Screen name="guess-song" options={{ title: 'Gjett Sangen' }} />
          <Stack.Screen name="bomba-game" options={{ title: 'Bomba' }} />
          <Stack.Screen name="music-game" options={{ title: 'Music Game' }} />
          <Stack.Screen name="settings" options={{ title: 'Innstillinger' }} />
        </Stack>
      </ThemeProvider>
    </GameSessionProvider>
  );
}

export function ErrorBoundary(props: { error: Error; retry: () => void }) {
  return (
    <View style={styles.errorScreen}>
      <View style={styles.errorCard}>
        <Text style={styles.errorTitle}>Appen krasjet</Text>
        <Text style={styles.errorBody}>
          Det oppsto en runtime-feil. Hvis dette skjer etter Spotify-login, send denne teksten videre:
        </Text>
        <Text selectable style={styles.errorMessage}>
          {props.error.message}
        </Text>
        <Pressable onPress={props.retry} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Prøv igjen</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  errorScreen: {
    flex: 1,
    backgroundColor: '#050508',
    justifyContent: 'center',
    padding: 24,
  },
  errorCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#5E2A3A',
    backgroundColor: '#1A0D14',
    padding: 20,
    gap: 12,
  },
  errorTitle: {
    color: '#FFF4F6',
    fontSize: 28,
    fontWeight: '900',
  },
  errorBody: {
    color: '#F3C3CE',
    fontSize: 15,
    lineHeight: 22,
  },
  errorMessage: {
    color: '#FFB3C0',
    fontSize: 14,
    fontWeight: '700',
  },
  errorButton: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: '#FF33CC',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  errorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
});
