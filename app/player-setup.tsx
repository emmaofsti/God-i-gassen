import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useState } from 'react';

import { BottomDock } from '@/src/components/BottomDock';
import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { sessionLimits, useGameSession } from '@/src/context/GameSessionContext';
import { GameMode } from '@/src/types/game';

function nextGameRoute(mode: GameMode) {
  if (mode === 'cards') {
    return '/card-game';
  }
  if (mode === 'wheel') {
    return '/wheel-game';
  }
  if (mode === 'guess-song') {
    return '/guess-song';
  }
  if (mode === 'bomba') {
    return '/bomba-game';
  }
  return '/music-game';
}

export default function PlayerSetupScreen() {
  const router = useRouter();
  const { players, addPlayer, removePlayer, movePlayer, mode, isHydrated } = useGameSession();
  const [nameInput, setNameInput] = useState('');

  const canAdd = nameInput.trim().length > 0 && players.length < sessionLimits.maximumPlayers;
  const canStart = players.length >= sessionLimits.minimumPlayers;

  return (
    <ScreenContainer scroll>
      <PartyLogo compact />

      <View style={styles.headerCard}>
        <Text style={styles.title}>Spilleroppsett</Text>
        <Text style={styles.subtitle}>
          Legg til {sessionLimits.minimumPlayers}-{sessionLimits.maximumPlayers} spillere. Rekkefølgen her brukes i
          rundene.
        </Text>
        {mode === 'guess-song' ? (
          <Text style={styles.modeHint}>Gjett Sangen trenger bare spillere nå. Lydopptak er fjernet foreløpig.</Text>
        ) : null}
      </View>

      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          <TextInput
            value={nameInput}
            onChangeText={setNameInput}
            placeholder="Skriv navn"
            placeholderTextColor={theme.colors.mutedText}
            style={styles.input}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={22}
            onSubmitEditing={() => {
              if (!canAdd) {
                return;
              }
              addPlayer(nameInput);
              setNameInput('');
            }}
          />
          <Pressable
            onPress={() => {
              if (!canAdd) {
                return;
              }
              addPlayer(nameInput);
              setNameInput('');
            }}
            disabled={!canAdd}
            style={({ pressed }) => [
              styles.addButton,
              !canAdd && styles.addButtonDisabled,
              pressed && canAdd && styles.addButtonPressed,
            ]}
          >
            <Text style={styles.addButtonText}>Legg til</Text>
          </Pressable>
        </View>

        <Text style={styles.countText}>
          Spillere: {players.length}/{sessionLimits.maximumPlayers}
        </Text>
        {!isHydrated ? <Text style={styles.hydrateText}>Laster sist brukte spillere...</Text> : null}
      </View>

      <View style={styles.playerList}>
        {players.map((player, index) => (
          <View key={player.id} style={styles.playerRow}>
            <Text style={styles.playerName}>{`${index + 1}. ${player.name}`}</Text>

            <View style={styles.playerActions}>
              <Pressable
                onPress={() => movePlayer(player.id, 'up')}
                disabled={index === 0}
                style={[styles.rowButton, index === 0 && styles.rowButtonDisabled]}
              >
                <Text style={styles.rowButtonText}>Opp</Text>
              </Pressable>
              <Pressable
                onPress={() => movePlayer(player.id, 'down')}
                disabled={index === players.length - 1}
                style={[styles.rowButton, index === players.length - 1 && styles.rowButtonDisabled]}
              >
                <Text style={styles.rowButtonText}>Ned</Text>
              </Pressable>
              <Pressable onPress={() => removePlayer(player.id)} style={[styles.rowButton, styles.removeButton]}>
                <Text style={[styles.rowButtonText, styles.removeButtonText]}>Fjern</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      {players.length > 0 && !canStart ? (
        <Text style={styles.startHint}>Legg til minst {sessionLimits.minimumPlayers} spillere for å starte.</Text>
      ) : null}

      <BottomDock style={styles.footerActions}>
        <SecondaryButton title="Tilbake" onPress={() => router.back()} />
        <PrimaryButton title="Start spill" onPress={() => router.push(nextGameRoute(mode))} disabled={!canStart} />
      </BottomDock>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: '#0D0A1499',
    borderWidth: 1,
    borderColor: '#2A1F3566',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  title: {
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    color: theme.colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
  },
  modeHint: {
    color: '#FF99E0',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  inputCard: {
    backgroundColor: '#0D0A14AA',
    borderWidth: 1,
    borderColor: '#2A1F3577',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#0A0610',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#2A1F35',
    color: theme.colors.text,
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  addButton: {
    backgroundColor: theme.colors.accent,
    borderRadius: theme.radius.md,
    minHeight: 50,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF33CC',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  addButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  addButtonDisabled: {
    opacity: 0.45,
    shadowOpacity: 0,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  countText: {
    color: theme.colors.mutedText,
    fontSize: 14,
  },
  hydrateText: {
    color: theme.colors.mutedText,
    fontSize: 13,
  },
  playerList: {
    gap: theme.spacing.sm,
  },
  playerRow: {
    backgroundColor: '#0D0A14',
    borderWidth: 1,
    borderColor: '#2A1F3577',
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  playerName: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  playerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  rowButton: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#3D2A50',
    backgroundColor: '#0D0A14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowButtonDisabled: {
    opacity: 0.35,
  },
  rowButtonText: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  removeButton: {
    borderColor: '#8F5165',
    backgroundColor: '#28131B',
  },
  removeButtonText: {
    color: '#FFB5C5',
  },
  startHint: {
    color: theme.colors.mutedText,
    fontSize: 14,
    textAlign: 'center',
  },
  footerActions: {
    marginBottom: theme.spacing.lg,
  },
});
