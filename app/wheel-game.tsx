import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import wheelData from '@/data/wheelSegments.json';
import { BottomDock } from '@/src/components/BottomDock';
import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { useGameSession } from '@/src/context/GameSessionContext';
import { spinWheelResult } from '@/src/game/wheelEngine';
import { WheelSegment } from '@/src/types/game';

const segments = wheelData as WheelSegment[];
const COOLDOWN_MS = 1500;

const wheelPalette = ['#FF33CC', '#FFCC66', '#33CCFF', '#33FFCC', '#CC0066', '#CC9966'];

export default function WheelGameScreen() {
  const router = useRouter();
  const { players } = useGameSession();
  const { width } = useWindowDimensions();

  const [isSpinning, setIsSpinning] = useState(false);
  const [result, setResult] = useState<WheelSegment | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [lastSpinAt, setLastSpinAt] = useState(0);

  const rotation = useRef(new Animated.Value(0)).current;
  const rotationValue = useRef(0);
  const wheelSize = Math.min(width - 52, 340);

  const animatedRotation = useMemo(
    () =>
      rotation.interpolate({
        inputRange: [0, 360],
        outputRange: ['0deg', '360deg'],
      }),
    [rotation]
  );

  const canPlay = players.length >= 2;

  const onSpin = () => {
    const now = Date.now();
    if (!canPlay || isSpinning || now - lastSpinAt < COOLDOWN_MS) {
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
      const randomPlayer = players[Math.floor(Math.random() * players.length)]!;
      setSelectedPlayer(randomPlayer.name);
      setIsSpinning(false);
    });
  };

  if (!canPlay) {
    return (
      <ScreenContainer>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>For få spillere</Text>
          <Text style={styles.emptyBody}>Du trenger minst 2 spillere for å spille wheel-modus.</Text>
          <PrimaryButton title="Gå til spilleroppsett" onPress={() => router.replace('/player-setup')} />
        </View>
      </ScreenContainer>
    );
  }

  const segmentAngle = 360 / segments.length;
  const labelRadius = wheelSize / 2 - 36;

  return (
    <ScreenContainer>
      <PartyLogo compact />

      <View style={styles.header}>
        <Text style={styles.title}>Spin The Wheel</Text>
        <Text style={styles.subtitle}>Én knapp. Én skjebne. Én taper.</Text>
      </View>

      <View style={styles.wheelArea}>
        <View style={styles.pointer} />
        <View style={[styles.ringGlow, { width: wheelSize + 24, height: wheelSize + 24, borderRadius: (wheelSize + 24) / 2 }]} />
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
                <Text style={[styles.segmentText, { color: chipColor }]}>{segment.label}</Text>
              </View>
            );
          })}

          <View style={styles.hubOuter}>
            <View style={styles.hubInner} />
          </View>
        </Animated.View>
      </View>

      <BottomDock style={styles.bottomArea}>
        <PrimaryButton title={isSpinning ? 'Spinner...' : 'SPIN'} onPress={onSpin} disabled={isSpinning} />
        {result ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultPlayerName}>{selectedPlayer}</Text>
            <Text style={styles.resultTitle}>{result.label}</Text>
            <Text style={styles.resultBody}>{result.ruleText}</Text>
          </View>
        ) : (
          <Text style={styles.resultHint}>Ingen resultat ennå. Trykk SPIN.</Text>
        )}
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
  wheelArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  ringGlow: {
    position: 'absolute',
    backgroundColor: '#FF33CC18',
    shadowColor: '#FF33CC',
    shadowOpacity: 0.5,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 0 },
  },
  wheel: {
    backgroundColor: '#0D0A14',
    borderColor: '#5A307AA0',
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
    fontSize: 11,
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
    borderBottomColor: theme.colors.accent,
    zIndex: 10,
    shadowColor: '#FF33CC',
    shadowOpacity: 0.8,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  hubOuter: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#2A1040',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FF33CC',
  },
  hubInner: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFCC66',
  },
  bottomArea: {
    marginTop: theme.spacing.xs,
  },
  resultCard: {
    backgroundColor: '#0D0A1499',
    borderColor: '#3D2A5088',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  resultPlayerName: {
    color: theme.colors.accent,
    fontSize: 28,
    fontWeight: '900',
  },
  resultTitle: {
    color: theme.colors.text,
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
