import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import cardsData from '@/data/cards.json';
import { BottomDock } from '@/src/components/BottomDock';
import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { useGameSession } from '@/src/context/GameSessionContext';
import { drawRenderedCard } from '@/src/game/cardEngine';
import { CardCategory, CardTemplate, RenderedCard } from '@/src/types/game';

const deck = cardsData as CardTemplate[];

const categoryColor: Record<CardCategory, string> = {
  drink: theme.colors.chipDrink,
  give: theme.colors.chipGive,
  everyone: theme.colors.chipEveryone,
  rule: theme.colors.chipRule,
  challenge: theme.colors.chipChallenge,
  social: theme.colors.chipSocial,
};

const categoryLabel: Record<CardCategory, string> = {
  drink: 'Drikk',
  give: 'Gi',
  everyone: 'Alle',
  rule: 'Regel',
  challenge: 'Utfordring',
  social: 'Sosial',
};

export default function CardGameScreen() {
  const router = useRouter();
  const { players } = useGameSession();
  const [currentCard, setCurrentCard] = useState<RenderedCard | null>(null);

  const canPlay = players.length >= 2;

  const nextCard = useMemo(
    () => () => {
      if (!canPlay) {
        return;
      }
      setCurrentCard(drawRenderedCard(deck, players));
    },
    [canPlay, players]
  );

  useEffect(() => {
    if (canPlay && !currentCard) {
      nextCard();
    }
  }, [canPlay, currentCard, nextCard]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 16,
        onPanResponderRelease: (_, gestureState) => {
          if (Math.abs(gestureState.dx) > 50) {
            nextCard();
          }
        },
      }),
    [nextCard]
  );

  if (!canPlay) {
    return (
      <ScreenContainer>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>For få spillere</Text>
          <Text style={styles.emptyBody}>Du trenger minst 2 spillere for å starte kortspill.</Text>
          <PrimaryButton title="Gå til spilleroppsett" onPress={() => router.replace('/player-setup')} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <PartyLogo compact />

      <View style={styles.header}>
        <Text style={styles.title}>Kortspill</Text>
        <Text style={styles.subtitle}>Swipe eller trykk på kortet for neste utfordring.</Text>
      </View>

      <Pressable style={styles.cardPressArea} onPress={nextCard} {...panResponder.panHandlers}>
        {currentCard ? (
          <LinearGradient colors={['#13243A', '#13142D']} style={styles.card}>
            <View style={[styles.categoryChip, { backgroundColor: categoryColor[currentCard.category] }]}>
              <Text style={styles.categoryText}>{categoryLabel[currentCard.category]}</Text>
            </View>
            <Text style={styles.cardText}>{currentCard.renderedText}</Text>
            <Text style={styles.gestureHint}>Trykk eller swipe for neste</Text>
          </LinearGradient>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardText}>Laster kort...</Text>
          </View>
        )}
      </Pressable>

      <BottomDock style={styles.actions}>
        <PrimaryButton title="Neste kort" onPress={nextCard} />
        <SecondaryButton title="Avslutt" onPress={() => router.replace('/')} />
      </BottomDock>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: theme.spacing.xs,
    marginTop: 2,
  },
  title: {
    color: theme.colors.text,
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: theme.colors.mutedText,
    fontSize: 15,
  },
  cardPressArea: {
    flex: 1,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#4A5B8277',
    borderRadius: theme.radius.xl,
    padding: theme.spacing.md,
    justifyContent: 'space-between',
    shadowColor: '#6B90FF',
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  categoryChip: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
  },
  categoryText: {
    color: '#0B1320',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  cardText: {
    color: theme.colors.text,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 40,
    flex: 1,
    marginTop: theme.spacing.md,
  },
  gestureHint: {
    color: '#A5B3D4',
    fontSize: 12,
    fontWeight: '700',
  },
  actions: {
    marginTop: theme.spacing.xs,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  emptyTitle: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  emptyBody: {
    color: theme.colors.mutedText,
    fontSize: 16,
    lineHeight: 24,
  },
});
