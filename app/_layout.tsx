import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-reanimated';

import { GameSessionProvider } from '@/src/context/GameSessionContext';

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: '#070A12',
    card: '#070A12',
    border: '#31415E',
    text: '#F7FAFF',
    primary: '#25F4EE',
    notification: '#FF5D73',
  },
};

export default function RootLayout() {
  return (
    <GameSessionProvider>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#070A12' },
            headerTintColor: '#F7FAFF',
            contentStyle: { backgroundColor: '#070A12' },
            headerShadowVisible: false,
            headerTitleStyle: { fontWeight: '800' },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="player-setup" options={{ title: 'Spillere' }} />
          <Stack.Screen name="card-game" options={{ title: 'Kortspill' }} />
          <Stack.Screen name="wheel-game" options={{ title: 'Spin The Wheel' }} />
          <Stack.Screen name="guess-song" options={{ title: 'Gjett Sangen' }} />
          <Stack.Screen name="music-game" options={{ title: 'Music Game' }} />
          <Stack.Screen name="settings" options={{ title: 'Innstillinger' }} />
        </Stack>
      </ThemeProvider>
    </GameSessionProvider>
  );
}
