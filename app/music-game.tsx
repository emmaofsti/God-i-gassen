import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { theme } from '@/src/constants/theme';

export default function MusicGameScreen() {
  const router = useRouter();

  return (
    <ScreenContainer>
      <PartyLogo compact />
      <View style={styles.card}>
        <Text style={styles.title}>Music Game</Text>
        <Text style={styles.body}>Denne modusen kommer i neste versjon. Bruk "Gjett Sangen" fra forsiden nå.</Text>
        <PrimaryButton title="Til Gjett Sangen" onPress={() => router.replace('/guess-song')} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: theme.spacing.md,
    backgroundColor: '#111A2A99',
    borderColor: '#3A547E88',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
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
});
