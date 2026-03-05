import { Link, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { ModeCard } from '@/src/components/ModeCard';
import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { theme } from '@/src/constants/theme';
import { useGameSession } from '@/src/context/GameSessionContext';
import { GameMode } from '@/src/types/game';

const modeOptions: { mode: GameMode; title: string; subtitle: string }[] = [
  {
    mode: 'cards',
    title: 'Kortspill',
    subtitle: 'Swipe eller trykk for neste kort. Dynamiske navn på alle utfordringer.',
  },
  {
    mode: 'wheel',
    title: 'Spin The Wheel',
    subtitle: 'Trykk SPIN og la hjulet velge hvem som må steppe opp.',
  },
  {
    mode: 'guess-song',
    title: 'Gjett Sangen',
    subtitle: 'Spotify + auto-stopp på rop. En egen spillmodus med mic-trigger.',
  },
  {
    mode: 'music',
    title: 'Music Game',
    subtitle: 'Ekstra musikkmodus (kommer snart).',
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { mode, setMode, players } = useGameSession();
  const { height: screenHeight } = useWindowDimensions();
  const [isBeerSplash, setIsBeerSplash] = useState(false);
  const beerFill = useRef(new Animated.Value(0)).current;
  const beerRows = useMemo(() => Array.from({ length: 42 }, () => '🍺 '.repeat(16)), []);

  const fillHeight = beerFill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight + 40],
  });

  const beerOverlayOpacity = beerFill.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 0.85, 1],
  });

  const startParty = () => {
    if (isBeerSplash) {
      return;
    }

    setIsBeerSplash(true);
    beerFill.setValue(0);

    Animated.timing(beerFill, {
      toValue: 1,
      duration: 2000,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(() => {
      setIsBeerSplash(false);
      router.push('/player-setup');
    });
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.hero}>
        <PartyLogo />
        <View style={styles.badges}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Mørkt tema</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Store knapper</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Offline-ready</Text>
          </View>
        </View>
      </View>

      <View style={styles.modeList}>
        {modeOptions.map((option) => (
          <ModeCard
            key={option.mode}
            mode={option.mode}
            selectedMode={mode}
            onSelect={setMode}
            title={option.title}
            subtitle={option.subtitle}
          />
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.playerHint}>Lagrede spillere: {players.length}</Text>
        <PrimaryButton title={isBeerSplash ? 'Skååål...' : 'Start festen'} onPress={startParty} disabled={isBeerSplash} />
        <Link href="/settings" style={styles.settingsLink}>
          Innstillinger
        </Link>
      </View>

      {isBeerSplash ? (
        <View style={styles.beerOverlay} pointerEvents="auto">
          <Animated.View style={[styles.beerTint, { opacity: beerOverlayOpacity }]} />
          <Animated.View style={[styles.beerFlood, { height: fillHeight }]}>
            <View style={styles.foamBand}>
              <Text style={styles.foamText}>SKÅL!</Text>
            </View>
            <View style={styles.beerGrid}>
              {beerRows.map((row, index) => (
                <Text key={`beer-row-${index}`} style={styles.beerRow}>
                  {row}
                </Text>
              ))}
            </View>
          </Animated.View>
        </View>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  badges: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: '#72B4FF55',
    backgroundColor: '#132038AA',
  },
  badgeText: {
    color: '#B9DAFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  modeList: {
    gap: theme.spacing.md,
  },
  footer: {
    gap: theme.spacing.sm,
    paddingBottom: theme.spacing.sm,
  },
  playerHint: {
    color: theme.colors.mutedText,
    fontSize: 14,
  },
  settingsLink: {
    color: '#A5B5D7',
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '700',
    paddingVertical: 8,
  },
  beerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  beerTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#06090F',
  },
  beerFlood: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#B46A05',
    borderTopWidth: 2,
    borderTopColor: '#FFD48A',
  },
  foamBand: {
    height: 34,
    backgroundColor: '#FFE4B8',
    borderBottomWidth: 1,
    borderBottomColor: '#F6C982',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foamText: {
    color: '#6A3E00',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
  beerGrid: {
    paddingTop: 4,
    paddingHorizontal: 6,
  },
  beerRow: {
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 1,
  },
});
