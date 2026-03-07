import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { theme } from '@/src/constants/theme';
import { GameMode } from '@/src/types/game';

type Props = {
  title: string;
  subtitle: string;
  mode: GameMode;
  selectedMode: GameMode;
  onSelect: (mode: GameMode) => void;
};

const modeTag: Record<GameMode, string> = {
  cards: 'CLASSIC',
  wheel: 'RANDOM',
  'guess-song': 'VOICE',
  music: 'SPOTIFY',
  bomba: 'BOMBA',
};

export function ModeCard({ title, subtitle, mode, selectedMode, onSelect }: Props) {
  const selected = selectedMode === mode;

  return (
    <Pressable onPress={() => onSelect(mode)} style={({ pressed }) => [pressed && styles.pressed]}>
      <View style={[styles.cardShell, selected && styles.cardShellSelected]}>
        {selected ? <LinearGradient colors={theme.gradients.selectedCard} style={StyleSheet.absoluteFillObject} /> : null}
        <View style={styles.headerRow}>
          <View style={styles.tagWrap}>
            <Text style={styles.tag}>{modeTag[mode]}</Text>
          </View>
          <View style={[styles.dot, selected && styles.dotSelected]} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.9,
  },
  cardShell: {
    overflow: 'hidden',
    borderRadius: theme.radius.lg,
    backgroundColor: '#0D0A1499',
    borderColor: '#2A1F3577',
    borderWidth: 1,
    padding: theme.spacing.md,
    minHeight: 138,
    gap: theme.spacing.sm,
  },
  cardShellSelected: {
    borderColor: '#FF33CCAA',
    shadowColor: '#FF33CC',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tagWrap: {
    borderRadius: theme.radius.pill,
    backgroundColor: '#1A0D20BB',
    borderWidth: 1,
    borderColor: '#FF33CC33',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tag: {
    color: '#FFCC66',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  title: {
    color: theme.colors.text,
    fontSize: 23,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  subtitle: {
    color: theme.colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: theme.radius.pill,
    borderWidth: 2,
    borderColor: '#5A4070',
  },
  dotSelected: {
    backgroundColor: theme.colors.accent,
    borderColor: theme.colors.accent,
  },
});
