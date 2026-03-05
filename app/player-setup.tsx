import { Audio, AVPlaybackStatus } from 'expo-av';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { sessionLimits, useGameSession } from '@/src/context/GameSessionContext';

function nextGameRoute(mode: 'cards' | 'wheel' | 'guess-song' | 'music') {
  if (mode === 'cards') {
    return '/card-game';
  }
  if (mode === 'wheel') {
    return '/wheel-game';
  }
  if (mode === 'guess-song') {
    return '/guess-song';
  }
  return '/music-game';
}

function formatDuration(durationMs?: number): string {
  if (!durationMs || durationMs < 1000) {
    return '<1s';
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

export default function PlayerSetupScreen() {
  const router = useRouter();
  const {
    players,
    playerSounds,
    addPlayer,
    removePlayer,
    movePlayer,
    mode,
    isHydrated,
    setPlayerSound,
    removePlayerSound,
  } = useGameSession();

  const [nameInput, setNameInput] = useState('');
  const [recordingPlayerId, setRecordingPlayerId] = useState<string | null>(null);
  const [playingPlayerId, setPlayingPlayerId] = useState<string | null>(null);
  const [setupMessage, setSetupMessage] = useState<string | null>(null);

  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const activeSoundRef = useRef<Audio.Sound | null>(null);

  const canRecordAudio = Platform.OS !== 'web';
  const isGuessSongMode = mode === 'guess-song';

  const canAdd = useMemo(
    () => nameInput.trim().length > 0 && players.length < sessionLimits.maximumPlayers,
    [nameInput, players.length]
  );

  const playersWithSoundCount = useMemo(
    () => players.filter((player) => Boolean(playerSounds[player.id])).length,
    [playerSounds, players]
  );

  const allGuessSongPlayersHaveSound = useMemo(
    () => players.length > 0 && players.every((player) => Boolean(playerSounds[player.id])),
    [playerSounds, players]
  );

  const canStart =
    players.length >= sessionLimits.minimumPlayers &&
    (!isGuessSongMode || (canRecordAudio && allGuessSongPlayersHaveSound));

  const stopPlayback = useCallback(async () => {
    const sound = activeSoundRef.current;
    activeSoundRef.current = null;

    if (!sound) {
      setPlayingPlayerId(null);
      return;
    }

    try {
      await sound.stopAsync();
    } catch {
      // Ignorer stop-feil under opprydding.
    }

    try {
      await sound.unloadAsync();
    } catch {
      // Ignorer unload-feil under opprydding.
    }

    setPlayingPlayerId(null);
  }, []);

  const stopRecording = useCallback(
    async (saveForPlayerId?: string) => {
      const recording = activeRecordingRef.current;
      activeRecordingRef.current = null;

      if (!recording) {
        setRecordingPlayerId(null);
        return;
      }

      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording || !status.isDoneRecording) {
          await recording.stopAndUnloadAsync();
        }
      } catch {
        // Ignorer stop-feil under opprydding.
      }

      let durationMs: number | undefined;
      try {
        const status = await recording.getStatusAsync();
        durationMs = typeof status.durationMillis === 'number' ? status.durationMillis : undefined;
      } catch {
        durationMs = undefined;
      }

      const uri = recording.getURI();
      setRecordingPlayerId(null);

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      }).catch(() => {
        // Ignorer mode-reset feil.
      });

      if (saveForPlayerId && uri) {
        setPlayerSound(saveForPlayerId, {
          uri,
          durationMs,
          createdAt: Date.now(),
        });
      }
    },
    [setPlayerSound]
  );

  useEffect(() => {
    return () => {
      void stopPlayback();
      void stopRecording();
    };
  }, [stopPlayback, stopRecording]);

  const toggleRecordingForPlayer = async (playerId: string, playerName: string) => {
    if (!canRecordAudio) {
      setSetupMessage('Lydopptak støttes kun i iOS/Android-app, ikke web.');
      return;
    }

    setSetupMessage(null);

    try {
      if (recordingPlayerId === playerId) {
        await stopRecording(playerId);
        setSetupMessage(`Lagret lyd for ${playerName}.`);
        return;
      }

      if (recordingPlayerId) {
        await stopRecording(recordingPlayerId);
      }

      await stopPlayback();

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setSetupMessage('Mikrofontillatelse mangler. Tillat mikrofon for å spille inn lyd.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();

      activeRecordingRef.current = recording;
      setRecordingPlayerId(playerId);
      setSetupMessage(`Spiller inn lyd for ${playerName}. Trykk "Stopp opptak" når du er ferdig.`);
    } catch (error) {
      setSetupMessage(
        error instanceof Error ? `Kunne ikke starte opptak: ${error.message}` : 'Kunne ikke starte opptak.'
      );
    }
  };

  const playPlayerSound = async (playerId: string, playerName: string) => {
    const soundData = playerSounds[playerId];
    if (!soundData) {
      return;
    }

    setSetupMessage(null);

    try {
      if (recordingPlayerId) {
        await stopRecording(recordingPlayerId);
      }

      await stopPlayback();

      const { sound } = await Audio.Sound.createAsync({ uri: soundData.uri }, { shouldPlay: true });
      activeSoundRef.current = sound;
      setPlayingPlayerId(playerId);
      setSetupMessage(`Spiller av lyd for ${playerName}.`);

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          return;
        }

        if (status.didJustFinish) {
          void stopPlayback();
        }
      });
    } catch (error) {
      setSetupMessage(
        error instanceof Error ? `Kunne ikke spille av lyd: ${error.message}` : 'Kunne ikke spille av lyd.'
      );
    }
  };

  const deletePlayerSound = async (playerId: string) => {
    if (recordingPlayerId === playerId) {
      await stopRecording();
    }
    if (playingPlayerId === playerId) {
      await stopPlayback();
    }

    removePlayerSound(playerId);
    setSetupMessage('Lyd slettet.');
  };

  return (
    <ScreenContainer scroll>
      <PartyLogo compact />

      <View style={styles.headerCard}>
        <Text style={styles.title}>Spilleroppsett</Text>
        <Text style={styles.subtitle}>
          Legg til {sessionLimits.minimumPlayers}-{sessionLimits.maximumPlayers} spillere. Rekkefølgen her brukes i
          rundene.
        </Text>
        {isGuessSongMode ? (
          <Text style={styles.modeHint}>
            Gjett Sangen: alle spillere må ha en innspilt lyd før du kan starte.
          </Text>
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
          />
          <Pressable
            onPress={() => {
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
        {isGuessSongMode ? (
          <Text style={styles.countText}>Lyd klare: {playersWithSoundCount}/{players.length || 0}</Text>
        ) : null}
        {!isHydrated ? <Text style={styles.hydrateText}>Laster sist brukte spillere...</Text> : null}
        {setupMessage ? <Text style={styles.setupMessage}>{setupMessage}</Text> : null}
      </View>

      {isGuessSongMode && !canRecordAudio ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>Lydopptak støttes i mobilapp (iOS/Android), ikke i webvisning.</Text>
        </View>
      ) : null}

      <View style={styles.playerList}>
        {players.map((player, index) => {
          const soundData = playerSounds[player.id];
          const hasSound = Boolean(soundData);
          const isRecordingThisPlayer = recordingPlayerId === player.id;

          return (
            <View key={player.id} style={styles.playerRow}>
              <Text style={styles.playerName}>{`${index + 1}. ${player.name}`}</Text>

              {isGuessSongMode ? (
                <View style={styles.soundRow}>
                  <Text style={styles.soundStatus}>
                    {hasSound ? `Lyd lagret (${formatDuration(soundData?.durationMs)})` : 'Ingen lyd lagret'}
                  </Text>
                </View>
              ) : null}

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
                <Pressable
                  onPress={async () => {
                    if (recordingPlayerId === player.id) {
                      await stopRecording();
                    }
                    if (playingPlayerId === player.id) {
                      await stopPlayback();
                    }
                    removePlayer(player.id);
                  }}
                  style={[styles.rowButton, styles.removeButton]}
                >
                  <Text style={[styles.rowButtonText, styles.removeButtonText]}>Fjern</Text>
                </Pressable>
              </View>

              {isGuessSongMode ? (
                <View style={styles.playerActions}>
                  <Pressable
                    onPress={() => toggleRecordingForPlayer(player.id, player.name)}
                    disabled={!canRecordAudio}
                    style={[
                      styles.rowButton,
                      styles.soundActionButton,
                      isRecordingThisPlayer && styles.recordingButton,
                      !canRecordAudio && styles.rowButtonDisabled,
                    ]}
                  >
                    <Text style={styles.rowButtonText}>
                      {isRecordingThisPlayer ? 'Stopp opptak' : hasSound ? 'Ta opp på nytt' : 'Ta opp lyd'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => playPlayerSound(player.id, player.name)}
                    disabled={!hasSound || Boolean(recordingPlayerId)}
                    style={[
                      styles.rowButton,
                      styles.soundActionButton,
                      (!hasSound || Boolean(recordingPlayerId)) && styles.rowButtonDisabled,
                      playingPlayerId === player.id && styles.playingButton,
                    ]}
                  >
                    <Text style={styles.rowButtonText}>{playingPlayerId === player.id ? 'Spiller...' : 'Spill av'}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => deletePlayerSound(player.id)}
                    disabled={!hasSound}
                    style={[
                      styles.rowButton,
                      styles.soundActionButton,
                      styles.removeButton,
                      !hasSound && styles.rowButtonDisabled,
                    ]}
                  >
                    <Text style={[styles.rowButtonText, styles.removeButtonText]}>Slett lyd</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {isGuessSongMode && !allGuessSongPlayersHaveSound && players.length >= sessionLimits.minimumPlayers ? (
        <Text style={styles.startHint}>Spill inn lyd for alle spillere for å starte Gjett Sangen.</Text>
      ) : null}

      <View style={styles.footerActions}>
        <SecondaryButton title="Tilbake" onPress={() => router.back()} />
        <PrimaryButton title="Start spill" onPress={() => router.push(nextGameRoute(mode))} disabled={!canStart} />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    backgroundColor: '#111A2A99',
    borderWidth: 1,
    borderColor: '#37507A66',
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
    color: '#9EF6E3',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  inputCard: {
    backgroundColor: '#101726AA',
    borderWidth: 1,
    borderColor: '#30405D77',
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
    backgroundColor: '#0E1422',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#364765',
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
    shadowColor: '#2DF4ED',
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
    color: '#07181E',
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
  setupMessage: {
    color: '#B6FFE9',
    fontSize: 13,
    fontWeight: '700',
  },
  warningCard: {
    backgroundColor: '#30240F88',
    borderColor: '#8A6C3C99',
    borderWidth: 1,
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
  },
  warningText: {
    color: '#FFDCA8',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  playerList: {
    gap: theme.spacing.sm,
    marginTop: 2,
  },
  playerRow: {
    backgroundColor: '#11192AAB',
    borderRadius: theme.radius.md,
    borderColor: '#33476477',
    borderWidth: 1,
    padding: 12,
    gap: theme.spacing.sm,
  },
  playerName: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  soundRow: {
    flexDirection: 'row',
  },
  soundStatus: {
    color: '#97ECDD',
    fontSize: 13,
    fontWeight: '700',
  },
  playerActions: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  rowButton: {
    borderRadius: theme.radius.sm,
    backgroundColor: '#1A2740',
    borderWidth: 1,
    borderColor: '#4C648A77',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  soundActionButton: {
    minWidth: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingButton: {
    borderColor: '#B8FF6B99',
    backgroundColor: '#213211DD',
  },
  playingButton: {
    borderColor: '#6BC7FF99',
    backgroundColor: '#173A59D9',
  },
  rowButtonDisabled: {
    opacity: 0.4,
  },
  rowButtonText: {
    color: theme.colors.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  removeButton: {
    borderColor: '#FF6E8A66',
    backgroundColor: '#2A151DCC',
  },
  removeButtonText: {
    color: '#FF9DB0',
  },
  startHint: {
    color: '#FFD6A1',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  footerActions: {
    marginTop: theme.spacing.md,
    gap: theme.spacing.sm,
  },
});
