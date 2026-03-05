import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { theme } from '@/src/constants/theme';

type Props = {
  compact?: boolean;
};

export function PartyLogo({ compact = false }: Props) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.05],
  });

  const glowOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.8],
  });

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <Animated.View
        style={[
          styles.glow,
          compact && styles.glowCompact,
          {
            transform: [{ scale }],
            opacity: glowOpacity,
          },
        ]}
      />

      <Animated.View style={{ transform: [{ scale }] }}>
        <LinearGradient colors={theme.gradients.logoRing} style={[styles.emblem, compact && styles.emblemCompact]}>
          <View style={[styles.innerCircle, compact && styles.innerCircleCompact]}>
            <Text style={[styles.mark, compact && styles.markCompact]}>GG</Text>
          </View>
        </LinearGradient>
      </Animated.View>

      <View style={styles.textBlock}>
        <Text style={[styles.title, compact && styles.titleCompact]}>GOD I GASSEN</Text>
        {!compact ? <Text style={styles.subtitle}>Norsk drikkelek med neon vibe</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  wrapCompact: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: theme.spacing.md,
  },
  glow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: '#1AF0E8',
    top: -10,
    shadowColor: '#21F4E8',
    shadowOpacity: 0.8,
    shadowRadius: 34,
    shadowOffset: { width: 0, height: 0 },
  },
  glowCompact: {
    width: 74,
    height: 74,
    borderRadius: 37,
    top: -8,
    left: -2,
  },
  emblem: {
    width: 130,
    height: 130,
    borderRadius: 65,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emblemCompact: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  innerCircle: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: '#0A1020',
    borderWidth: 1,
    borderColor: '#6BC4FF66',
    justifyContent: 'center',
    alignItems: 'center',
  },
  innerCircleCompact: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  mark: {
    color: theme.colors.text,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 2,
  },
  markCompact: {
    fontSize: 20,
    letterSpacing: 1,
  },
  textBlock: {
    alignItems: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  titleCompact: {
    fontSize: 18,
    letterSpacing: 1,
  },
  subtitle: {
    color: theme.colors.mutedText,
    fontSize: 13,
    marginTop: 2,
  },
});
