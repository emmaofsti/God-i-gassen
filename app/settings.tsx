import { StyleSheet, Text, View } from 'react-native';

import { PartyLogo } from '@/src/components/PartyLogo';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { useGameSession } from '@/src/context/GameSessionContext';

export default function SettingsScreen() {
  const { resetPlayers, players } = useGameSession();

  return (
    <ScreenContainer>
      <PartyLogo compact />
      <View style={styles.container}>
        <Text style={styles.title}>Innstillinger</Text>
        <Text style={styles.body}>Spillere lagres lokalt på enheten (offline) med AsyncStorage.</Text>
        <Text style={styles.counter}>Lagrede spillere: {players.length}</Text>
        <SecondaryButton title="Reset spillere" onPress={resetPlayers} danger />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    backgroundColor: '#111A2A99',
    borderColor: '#3A547E88',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  body: {
    color: theme.colors.mutedText,
    fontSize: 16,
    lineHeight: 24,
  },
  counter: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
});
