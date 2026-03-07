import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import bombaData from '@/data/bombaSegments.json';
import { BottomDock } from '@/src/components/BottomDock';
import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { useGameSession } from '@/src/context/GameSessionContext';
import { spinWheelResult } from '@/src/game/wheelEngine';
import { WheelSegment } from '@/src/types/game';

const segments = bombaData as WheelSegment[];
const COOLDOWN_MS = 1500;

const wheelPalette = ['#FF6B6B', '#FFA94D', '#FFD43B', '#FF6B6B', '#FFA94D', '#FFD43B', '#FF6B6B', '#FFA94D', '#FFD43B'];

const timerOptions = [
  { label: '30 sek', seconds: 30 },
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '3 min', seconds: 180 },
  { label: '4 min', seconds: 240 },
  { label: '5 min', seconds: 300 },
  { label: '6 min', seconds: 360 },
];

function playBoomSound() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();

    // Low frequency boom
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 0.8);
    oscGain.gain.setValueAtTime(1, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.8);

    // Noise burst for impact
    const bufferSize = ctx.sampleRate * 0.5;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 3);
    }
    const noise = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    noise.buffer = noiseBuffer;
    noiseGain.gain.setValueAtTime(0.8, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    noise.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(ctx.currentTime);

    // Second low thump
    const osc2 = ctx.createOscillator();
    const osc2Gain = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(40, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 1.2);
    osc2Gain.gain.setValueAtTime(0.6, ctx.currentTime);
    osc2Gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    osc2.connect(osc2Gain);
    osc2Gain.connect(ctx.destination);
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 1.2);

    setTimeout(() => ctx.close(), 2000);
  } catch {
    // Audio not available
  }
}

function triggerVibration() {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate([200, 100, 300, 100, 500]);
  }
}

type Phase = 'setup' | 'playing' | 'exploded';

export default function BombaGameScreen() {
  const router = useRouter();
  const { players } = useGameSession();
  const { width } = useWindowDimensions();

  const [phase, setPhase] = useState<Phase>('setup');
  const [selectedTime, setSelectedTime] = useState(60);
  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<WheelSegment | null>(null);
  const [lastSpinAt, setLastSpinAt] = useState(0);

  const rotation = useRef(new Animated.Value(0)).current;
  const rotationValue = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelSize = Math.min(width - 52, 340);

  // Explosion animation
  const explosionScale = useRef(new Animated.Value(0)).current;
  const explosionOpacity = useRef(new Animated.Value(0)).current;
  const flashOpacity = useRef(new Animated.Value(0)).current;
  const boomTextScale = useRef(new Animated.Value(0.3)).current;

  const animatedRotation = useMemo(
    () =>
      rotation.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
      }),
    [rotation]
  );

  const canPlay = players.length >= 2;

  const triggerExplosion = useCallback(() => {
    setPhase('exploded');
    playBoomSound();
    triggerVibration();

    // Flash
    Animated.sequence([
      Animated.timing(flashOpacity, {
        toValue: 1,
        duration: 100,
        useNativeDriver: false,
      }),
      Animated.timing(flashOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();

    // Explosion circle expanding
    Animated.parallel([
      Animated.timing(explosionOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }),
      Animated.spring(explosionScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(boomTextScale, {
        toValue: 1,
        friction: 3,
        tension: 50,
        useNativeDriver: true,
      }),
    ]).start();
  }, [explosionScale, explosionOpacity, flashOpacity, boomTextScale]);

  const startGame = useCallback(() => {
    setPhase('playing');
    setResult(null);

    timerRef.current = setTimeout(() => {
      triggerExplosion();
    }, selectedTime * 1000);
  }, [selectedTime, triggerExplosion]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const onSpin = () => {
    const now = Date.now();
    if (!canPlay || isSpinning || now - lastSpinAt < COOLDOWN_MS || phase !== 'playing') {
      return;
    }

    const spinResult = spinWheelResult(segments);
    const target = rotationValue.current + spinResult.rotationDeg;

    setIsSpinning(true);
    setLastSpinAt(now);

    Animated.timing(rotation, {
      toValue: target,
      duration: 3600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      rotationValue.current = target;
      setResult(spinResult.segment);
      setIsSpinning(false);
    });
  };

  const resetGame = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    setPhase('setup');
    setResult(null);
    setIsSpinning(false);
    explosionScale.setValue(0);
    explosionOpacity.setValue(0);
    flashOpacity.setValue(0);
    boomTextScale.setValue(0.3);
    rotation.setValue(0);
    rotationValue.current = 0;
  };

  if (!canPlay) {
    return (
      <ScreenContainer>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>For få spillere</Text>
          <Text style={styles.emptyBody}>Du trenger minst 2 spillere for å spille Bomba.</Text>
          <PrimaryButton title="Gå til spilleroppsett" onPress={() => router.replace('/player-setup')} />
        </View>
      </ScreenContainer>
    );
  }

  // Phase: Timer Setup
  if (phase === 'setup') {
    return (
      <ScreenContainer>
        <PartyLogo compact />
        <View style={styles.header}>
          <Text style={styles.title}>Bomba</Text>
          <Text style={styles.subtitle}>Still inn timeren. Bare du kan se dette!</Text>
        </View>

        <View style={styles.timerSetup}>
          <Text style={styles.timerLabel}>Velg tid:</Text>
          <View style={styles.timerGrid}>
            {timerOptions.map((opt) => (
              <Pressable
                key={opt.seconds}
                onPress={() => setSelectedTime(opt.seconds)}
                style={[
                  styles.timerChip,
                  selectedTime === opt.seconds && styles.timerChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.timerChipText,
                    selectedTime === opt.seconds && styles.timerChipTextSelected,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <BottomDock style={styles.bottomArea}>
          <PrimaryButton title="Start Bomba" onPress={startGame} />
          <SecondaryButton title="Avslutt" onPress={() => router.replace('/')} />
        </BottomDock>
      </ScreenContainer>
    );
  }

  // Phase: Exploded
  if (phase === 'exploded') {
    return (
      <ScreenContainer>
        <View style={styles.explosionContainer}>
          <Animated.View
            style={[
              styles.explosionCircle,
              {
                opacity: explosionOpacity,
                transform: [{ scale: explosionScale }],
              },
            ]}
          >
            <Animated.Text
              style={[
                styles.boomText,
                { transform: [{ scale: boomTextScale }] },
              ]}
            >
              BOOM!
            </Animated.Text>
            <Text style={styles.explosionSubtext}>Bomben gikk av!</Text>
            <Text style={styles.explosionVictim}>
              Den som holdt telefonen taper!
            </Text>
          </Animated.View>
        </View>

        <BottomDock style={styles.bottomArea}>
          <PrimaryButton title="Spill igjen" onPress={resetGame} />
          <SecondaryButton title="Avslutt" onPress={() => router.replace('/')} />
        </BottomDock>
      </ScreenContainer>
    );
  }

  // Phase: Playing (wheel)
  const segmentAngle = 360 / segments.length;
  const labelRadius = wheelSize / 2 - 36;

  return (
    <ScreenContainer>
      <PartyLogo compact />

      <View style={styles.header}>
        <Text style={styles.title}>Bomba</Text>
        <Text style={styles.subtitle}>Spinn hjulet og gjør som det står. Pass på – bomben tikker!</Text>
      </View>

      <View style={styles.wheelArea}>
        <View style={styles.pointer} />
        <View
          style={[
            styles.ringGlow,
            {
              width: wheelSize + 24,
              height: wheelSize + 24,
              borderRadius: (wheelSize + 24) / 2,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.wheel,
            {
              width: wheelSize,
              height: wheelSize,
              borderRadius: wheelSize / 2,
              transform: [{ rotate: animatedRotation }],
            },
          ]}
        >
          {segments.map((segment, index) => {
            const angle = index * segmentAngle - 90;
            const radians = (angle * Math.PI) / 180;
            const x = wheelSize / 2 + Math.cos(radians) * labelRadius;
            const y = wheelSize / 2 + Math.sin(radians) * labelRadius;
            const chipColor = wheelPalette[index % wheelPalette.length]!;

            return (
              <View
                key={segment.id}
                style={[
                  styles.segmentLabel,
                  {
                    left: x - 36,
                    top: y - 17,
                    transform: [{ rotate: `${angle + 90}deg` }],
                    borderColor: `${chipColor}88`,
                  },
                ]}
              >
                <Text style={[styles.segmentText, { color: chipColor }]}>
                  {segment.label}
                </Text>
              </View>
            );
          })}

          <View style={styles.hubOuter}>
            <View style={styles.hubInner} />
          </View>
        </Animated.View>
      </View>

      <BottomDock style={styles.bottomArea}>
        <PrimaryButton
          title={isSpinning ? 'Spinner...' : 'SPINN'}
          onPress={onSpin}
          disabled={isSpinning}
        />
        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultTitle}>{result.label}</Text>
            <Text style={styles.resultBody}>{result.ruleText}</Text>
          </View>
        ) : (
          <Text style={styles.resultHint}>Trykk SPINN for å starte.</Text>
        )}
        <SecondaryButton title="Avslutt" onPress={() => { resetGame(); router.replace('/'); }} />
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
  // Timer setup
  timerSetup: {
    flex: 1,
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  timerLabel: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  timerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  timerChip: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    borderWidth: 2,
    borderColor: '#2A1F35',
    backgroundColor: '#0D0A1499',
    minWidth: 90,
    alignItems: 'center',
  },
  timerChipSelected: {
    borderColor: '#FF6B6B',
    backgroundColor: '#FF6B6B22',
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  timerChipText: {
    color: theme.colors.mutedText,
    fontSize: 16,
    fontWeight: '800',
  },
  timerChipTextSelected: {
    color: '#FF6B6B',
  },
  // Wheel
  wheelArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  ringGlow: {
    position: 'absolute',
    backgroundColor: '#FF6B6B18',
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.4,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 0 },
  },
  wheel: {
    backgroundColor: '#0D0A14',
    borderColor: '#FF6B6B60',
    borderWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentLabel: {
    position: 'absolute',
    width: 72,
    minHeight: 34,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    backgroundColor: '#0A0610',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  segmentText: {
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'center',
  },
  pointer: {
    position: 'absolute',
    top: -4,
    width: 0,
    height: 0,
    borderLeftWidth: 17,
    borderRightWidth: 17,
    borderBottomWidth: 24,
    borderStyle: 'solid',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FF6B6B',
    zIndex: 10,
    shadowColor: '#FF6B6B',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  hubOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#4A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },
  hubInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FF6B6B',
  },
  bottomArea: {
    marginTop: theme.spacing.xs,
  },
  resultCard: {
    backgroundColor: '#0D0A1499',
    borderColor: '#FF6B6B44',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  resultTitle: {
    color: '#FF6B6B',
    fontSize: 24,
    fontWeight: '900',
  },
  resultBody: {
    color: theme.colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  resultHint: {
    color: theme.colors.mutedText,
    textAlign: 'center',
    fontSize: 14,
  },
  // Explosion
  explosionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FF4500',
    zIndex: 1,
    pointerEvents: 'none',
  },
  explosionCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#FF6B6B',
    zIndex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF4500',
    shadowOpacity: 0.9,
    shadowRadius: 50,
    shadowOffset: { width: 0, height: 0 },
  },
  boomText: {
    color: '#FFF',
    fontSize: 72,
    fontWeight: '900',
    textShadowColor: '#000',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 8,
  },
  explosionSubtext: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    marginTop: 8,
  },
  explosionVictim: {
    color: '#FFE4C4',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
    textAlign: 'center',
  },
  // Empty state
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
