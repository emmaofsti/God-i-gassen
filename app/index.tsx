import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { BottomDock } from '@/src/components/BottomDock';
import { ModeCard } from '@/src/components/ModeCard';
import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { sessionLimits, useGameSession } from '@/src/context/GameSessionContext';
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
    mode: 'bomba',
    title: 'Bomba',
    subtitle: 'Still en skjult timer. Spinn hjulet og send telefonen videre før bomben smeller!',
  },
];

function gameRoute(mode: GameMode): '/card-game' | '/wheel-game' | '/guess-song' | '/music-game' | '/bomba-game' {
  if (mode === 'cards') return '/card-game';
  if (mode === 'wheel') return '/wheel-game';
  if (mode === 'guess-song') return '/guess-song';
  if (mode === 'bomba') return '/bomba-game';
  return '/music-game';
}

export default function HomeScreen() {
  const router = useRouter();
  const { mode, setMode, players } = useGameSession();
  const { height: screenHeight } = useWindowDimensions();
  const [isBeerSplash, setIsBeerSplash] = useState(false);
  const beerFill = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const playersReady = players.length >= sessionLimits.minimumPlayers;

  const fillHeight = beerFill.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenHeight + 40],
  });

  const beerOverlayOpacity = beerFill.interpolate({
    inputRange: [0, 0.12, 1],
    outputRange: [0, 0.85, 1],
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || window.location.pathname !== '/') {
      return;
    }

    const search = window.location.search;
    const params = new URLSearchParams(search);
    if (!params.get('code')) {
      return;
    }

    router.replace(`/guess-song${search}` as '/guess-song');
  }, [router]);

  const navigateToGame = () => {
    setIsBeerSplash(false);
    animationRef.current?.stop();
    animationRef.current = null;
    beerFill.setValue(0);
    if (playersReady) {
      router.push(gameRoute(mode));
    } else {
      router.push('/player-setup');
    }
  };

  const startParty = () => {
    if (isBeerSplash) {
      navigateToGame();
      return;
    }

    setIsBeerSplash(true);
    beerFill.setValue(0);

    const anim = Animated.timing(beerFill, {
      toValue: 1,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    animationRef.current = anim;
    anim.start(({ finished }) => {
      if (finished) {
        navigateToGame();
      }
    });
  };

  return (
    <ScreenContainer scroll>
      <View style={styles.hero}>
        <PartyLogo />
        <Text style={styles.tagline}>Drikkespillet for venner</Text>
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

      <BottomDock style={styles.footer}>
        {playersReady ? (
          <Text style={styles.playerHint}>{players.length} spillere klare</Text>
        ) : (
          <Text style={styles.playerHint}>Legg til minst {sessionLimits.minimumPlayers} spillere for å starte</Text>
        )}
        <PrimaryButton title={isBeerSplash ? 'Skååål...' : 'Start festen'} onPress={startParty} />
        {playersReady ? (
          <SecondaryButton title="Endre spillere" onPress={() => router.push('/player-setup')} />
        ) : null}
        <SecondaryButton title="Innstillinger" onPress={() => router.push('/settings')} />
      </BottomDock>

      {isBeerSplash ? (
        <Pressable style={styles.beerOverlay} onPress={navigateToGame}>
          <Animated.View style={[styles.beerTint, { opacity: beerOverlayOpacity }]} />
          <Animated.View style={[styles.beerFlood, { height: fillHeight }]}>
            <View style={styles.foamBand}>
              <Text style={styles.foamText}>SKÅL!</Text>
            </View>
          </Animated.View>
        </Pressable>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  tagline: {
    color: theme.colors.mutedText,
    fontSize: 16,
    fontWeight: '700',
  },
  modeList: {
    gap: theme.spacing.md,
  },
  footer: {
    marginTop: theme.spacing.sm,
  },
  playerHint: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  beerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    zIndex: 50,
  },
  beerTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#050508',
  },
  beerFlood: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    backgroundColor: '#CC0066',
    borderTopWidth: 2,
    borderTopColor: '#FF33CC',
  },
  foamBand: {
    height: 34,
    backgroundColor: '#FF33CC',
    borderBottomWidth: 1,
    borderBottomColor: '#CC0066',
    justifyContent: 'center',
    alignItems: 'center',
  },
  foamText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1.3,
  },
});
