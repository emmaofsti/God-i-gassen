import * as AuthSession from 'expo-auth-session';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { useGameSession } from '@/src/context/GameSessionContext';
import { createMusicRound, MusicRound } from '@/src/game/musicEngine';
import {
  createInitialSoundTriggerState,
  evaluateSoundTrigger,
} from '@/src/game/soundTrigger';
import {
  clearSpotifyAuth,
  ensureSpotifyAuth,
  fetchSpotifyPlaylistTracks,
  fetchSpotifyPlaylists,
  fetchSpotifyUser,
  getSpotifyClientId,
  loadSpotifyAuth,
  pickRandomSpotifyTrack,
  saveSpotifyAuth,
  spotifyDiscovery,
  spotifyScopes,
  SpotifyAuthState,
  SpotifyPlaylist,
  SpotifyUser,
  toStoredAuthFromTokenPayload,
} from '@/src/music/spotify';

WebBrowser.maybeCompleteAuthSession();

const SOUND_POLL_MS = 120;

const recordingOptions = {
  ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
  android: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    isMeteringEnabled: true,
  },
  ios: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
    isMeteringEnabled: true,
  },
};

export default function MusicGameScreen() {
  const router = useRouter();
  const { players } = useGameSession();

  const clientId = getSpotifyClientId();
  const authRequestClientId = clientId || 'missing-client-id';
  const redirectUri = useMemo(() => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        return window.location.origin.replace('localhost', '127.0.0.1');
      }
      return 'http://127.0.0.1:8082';
    }

    return AuthSession.makeRedirectUri({ scheme: 'godigassen', path: 'redirect' });
  }, []);

  const [authState, setAuthState] = useState<SpotifyAuthState | null>(null);
  const [user, setUser] = useState<SpotifyUser | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState<MusicRound | null>(null);
  const [showReveal, setShowReveal] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isLoadingSpotifyData, setIsLoadingSpotifyData] = useState(false);
  const [isDrawingRound, setIsDrawingRound] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [isListeningForTrigger, setIsListeningForTrigger] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [triggerMessage, setTriggerMessage] = useState<string | null>(null);
  const [meteringDb, setMeteringDb] = useState<number | null>(null);

  const activeSoundRef = useRef<Audio.Sound | null>(null);
  const activeRecordingRef = useRef<Audio.Recording | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const triggerStateRef = useRef(createInitialSoundTriggerState());
  const pollBusyRef = useRef(false);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: authRequestClientId,
      redirectUri,
      scopes: spotifyScopes,
      responseType: AuthSession.ResponseType.Code,
      usePKCE: true,
    },
    spotifyDiscovery
  );

  const stopAudioSession = useCallback(async () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    const recording = activeRecordingRef.current;
    activeRecordingRef.current = null;

    if (recording) {
      try {
        const status = await recording.getStatusAsync();
        if (status.isRecording) {
          await recording.stopAndUnloadAsync();
        } else if (!status.isDoneRecording) {
          await recording.stopAndUnloadAsync();
        }
      } catch {
        // Ignorer oppryddingsfeil.
      }
    }

    const sound = activeSoundRef.current;
    activeSoundRef.current = null;

    if (sound) {
      try {
        await sound.stopAsync();
      } catch {
        // Ignorer stop-feil.
      }

      try {
        await sound.unloadAsync();
      } catch {
        // Ignorer unload-feil.
      }
    }

    setIsListeningForTrigger(false);
    setIsPreviewPlaying(false);
    setMeteringDb(null);
  }, []);

  const ensureFreshAuth = useCallback(async () => {
    if (!authState) {
      throw new Error('Mangler Spotify-token. Koble til Spotify først.');
    }
    if (!clientId) {
      throw new Error('Mangler EXPO_PUBLIC_SPOTIFY_CLIENT_ID.');
    }

    const fresh = await ensureSpotifyAuth(authState, clientId);
    if (fresh.accessToken !== authState.accessToken || fresh.expiresAt !== authState.expiresAt) {
      setAuthState(fresh);
    }

    return fresh;
  }, [authState, clientId]);

  useEffect(() => {
    return () => {
      void stopAudioSession();
    };
  }, [stopAudioSession]);

  useEffect(() => {
    let mounted = true;

    const hydrateSpotify = async () => {
      try {
        const stored = await loadSpotifyAuth();
        if (!stored || !mounted) {
          return;
        }

        if (!clientId) {
          setAuthState(stored);
          return;
        }

        try {
          const fresh = await ensureSpotifyAuth(stored, clientId);
          if (mounted) {
            setAuthState(fresh);
          }
        } catch {
          await clearSpotifyAuth();
          if (mounted) {
            setAuthState(null);
          }
        }
      } finally {
        if (mounted) {
          setIsHydrating(false);
        }
      }
    };

    hydrateSpotify();

    return () => {
      mounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!response || response.type !== 'success' || !response.params.code) {
      return;
    }

    let mounted = true;
    const finishAuth = async () => {
      if (!request?.codeVerifier || !clientId) {
        setErrorMessage('Innlogging feilet: mangler PKCE-verifier eller Client ID.');
        return;
      }

      setIsConnecting(true);
      setErrorMessage(null);

      try {
        const tokenResult = await AuthSession.exchangeCodeAsync(
          {
            clientId,
            code: response.params.code,
            redirectUri,
            extraParams: {
              code_verifier: request.codeVerifier,
            },
          },
          spotifyDiscovery
        );

        const nextAuth = toStoredAuthFromTokenPayload(
          {
            accessToken: tokenResult.accessToken,
            tokenType: tokenResult.tokenType,
            expiresIn: tokenResult.expiresIn,
            refreshToken: tokenResult.refreshToken,
          },
          authState?.refreshToken
        );

        await saveSpotifyAuth(nextAuth);
        if (mounted) {
          setAuthState(nextAuth);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Spotify-innlogging feilet.');
        }
      } finally {
        if (mounted) {
          setIsConnecting(false);
        }
      }
    };

    finishAuth();

    return () => {
      mounted = false;
    };
  }, [authState?.refreshToken, clientId, redirectUri, request?.codeVerifier, response]);

  useEffect(() => {
    if (!authState || !clientId) {
      setUser(null);
      setPlaylists([]);
      setSelectedPlaylistId(null);
      return;
    }

    let mounted = true;

    const loadSpotifyData = async () => {
      setIsLoadingSpotifyData(true);
      setErrorMessage(null);

      try {
        const fresh = await ensureFreshAuth();
        const [me, myPlaylists] = await Promise.all([
          fetchSpotifyUser(fresh.accessToken),
          fetchSpotifyPlaylists(fresh.accessToken, 30),
        ]);

        if (!mounted) {
          return;
        }

        setUser(me);
        setPlaylists(myPlaylists);
        setSelectedPlaylistId((previous) => {
          if (previous && myPlaylists.some((playlist) => playlist.id === previous)) {
            return previous;
          }
          return myPlaylists[0]?.id ?? null;
        });
      } catch (error) {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke hente Spotify-data.');
        }
      } finally {
        if (mounted) {
          setIsLoadingSpotifyData(false);
        }
      }
    };

    loadSpotifyData();

    return () => {
      mounted = false;
    };
  }, [authState, clientId, ensureFreshAuth]);

  const connectSpotify = async () => {
    if (!request) {
      setErrorMessage('Spotify-forespørsel er ikke klar enda. Prøv igjen om et sekund.');
      return;
    }

    setErrorMessage(null);
    setIsConnecting(true);

    try {
      await promptAsync();
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectSpotify = async () => {
    await stopAudioSession();
    await clearSpotifyAuth();
    setAuthState(null);
    setUser(null);
    setPlaylists([]);
    setSelectedPlaylistId(null);
    setCurrentRound(null);
    setShowReveal(false);
    setTriggerMessage(null);
    setErrorMessage(null);
  };

  const drawSpotifyRound = async () => {
    if (!selectedPlaylistId) {
      setErrorMessage('Velg en spilleliste først.');
      return;
    }

    setIsDrawingRound(true);
    setErrorMessage(null);

    try {
      await stopAudioSession();
      const fresh = await ensureFreshAuth();
      const tracks = await fetchSpotifyPlaylistTracks(fresh.accessToken, selectedPlaylistId, 100);
      const randomTrack = pickRandomSpotifyTrack(tracks);

      const round = createMusicRound(
        {
          id: randomTrack.id,
          name: randomTrack.name,
          artists: randomTrack.artists,
          spotifyUrl: randomTrack.spotifyUrl,
          previewUrl: randomTrack.previewUrl,
        },
        players
      );

      setCurrentRound(round);
      setTriggerMessage(round.previewUrl ? null : 'Denne låta har ingen preview hos Spotify. Trekk ny runde.');
      setShowReveal(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke trekke låt fra Spotify.');
    } finally {
      setIsDrawingRound(false);
    }
  };

  const stopBecauseTrigger = useCallback(async () => {
    await stopAudioSession();
    setTriggerMessage('Lyd registrert. Sangen stoppet umiddelbart.');
  }, [stopAudioSession]);

  const startVoiceStopRound = async () => {
    if (!currentRound?.previewUrl) {
      setTriggerMessage('Ingen preview tilgjengelig på denne låta.');
      return;
    }

    setErrorMessage(null);
    setTriggerMessage('Starter lytte-modus... rop høyt for å trigge stopp.');

    try {
      await stopAudioSession();

      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setTriggerMessage('Mikrofontillatelse mangler. Tillat mikrofon i appinnstillinger.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recordingOptions);
      await recording.startAsync();
      activeRecordingRef.current = recording;

      const { sound } = await Audio.Sound.createAsync(
        { uri: currentRound.previewUrl },
        { shouldPlay: true, progressUpdateIntervalMillis: 80 }
      );

      activeSoundRef.current = sound;
      setIsPreviewPlaying(true);
      setIsListeningForTrigger(true);
      triggerStateRef.current = createInitialSoundTriggerState();

      sound.setOnPlaybackStatusUpdate((status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          return;
        }

        setIsPreviewPlaying(status.isPlaying);

        if (status.didJustFinish) {
          void stopAudioSession();
          setTriggerMessage('Preview ble ferdig før noen trigget stopp.');
        }
      });

      pollIntervalRef.current = setInterval(() => {
        void (async () => {
          if (pollBusyRef.current) {
            return;
          }
          pollBusyRef.current = true;

          try {
            const activeRecording = activeRecordingRef.current;
            if (!activeRecording) {
              return;
            }

            const status = await activeRecording.getStatusAsync();
            if (!status.isRecording) {
              return;
            }

            const liveMeter = typeof status.metering === 'number' ? status.metering : -160;
            setMeteringDb(liveMeter);

            const { nextState, triggered } = evaluateSoundTrigger(
              triggerStateRef.current,
              liveMeter
            );

            triggerStateRef.current = nextState;

            if (triggered) {
              await stopBecauseTrigger();
            }
          } finally {
            pollBusyRef.current = false;
          }
        })();
      }, SOUND_POLL_MS);
    } catch (error) {
      await stopAudioSession();
      setTriggerMessage(
        error instanceof Error
          ? `Lydtrigger feilet: ${error.message}`
          : 'Lydtrigger feilet. Prøv en ny runde.'
      );
    }
  };

  const stopRoundManually = async () => {
    await stopAudioSession();
    setTriggerMessage('Runde stoppet manuelt.');
  };

  const canPlay = players.length >= 2;

  if (!canPlay) {
    return (
      <ScreenContainer>
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>For få spillere</Text>
          <Text style={styles.emptyBody}>Du trenger minst 2 spillere for å spille Gjett Sangen.</Text>
          <PrimaryButton title="Gå til spilleroppsett" onPress={() => router.replace('/player-setup')} />
        </View>
      </ScreenContainer>
    );
  }

  const clientIdMissing = !clientId;

  return (
    <ScreenContainer scroll>
      <PartyLogo compact />

      <View style={styles.heroCard}>
        <Text style={styles.title}>Gjett Sangen + Spotify</Text>
        <Text style={styles.subtitle}>Koble til Spotify, velg spilleliste og trekk en låt for rop-og-stopp-runde.</Text>
      </View>

      {clientIdMissing ? (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Mangler Spotify-oppsett</Text>
          <Text style={styles.infoText}>Spotify-integrasjon er ikke konfigurert ennå. Kontakt utvikler.</Text>
        </View>
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{user ? `Tilkoblet: ${user.display_name ?? user.id}` : 'Ikke tilkoblet'}</Text>
          <View style={styles.actionRow}>
            <PrimaryButton
              title={isConnecting ? 'Kobler til...' : user ? 'Koble til på nytt' : 'Koble til Spotify'}
              onPress={connectSpotify}
              disabled={isConnecting || !request}
              style={styles.actionButton}
            />
            <SecondaryButton title="Koble fra" onPress={disconnectSpotify} style={styles.actionButton} />
          </View>
        </View>
      )}

      {authState && !clientIdMissing ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spillelister</Text>
          {isHydrating || isLoadingSpotifyData ? (
            <Text style={styles.mutedText}>Laster Spotify-data...</Text>
          ) : playlists.length === 0 ? (
            <Text style={styles.mutedText}>Fant ingen spillelister på kontoen.</Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.playlistRow}>
              {playlists.map((playlist) => {
                const selected = playlist.id === selectedPlaylistId;
                return (
                  <Pressable
                    key={playlist.id}
                    onPress={() => setSelectedPlaylistId(playlist.id)}
                    style={[styles.playlistChip, selected && styles.playlistChipSelected]}
                  >
                    <Text style={[styles.playlistName, selected && styles.playlistNameSelected]}>{playlist.name}</Text>
                    <Text style={styles.playlistMeta}>{playlist.tracks.total} spor</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <PrimaryButton
            title={isDrawingRound ? 'Trekker låt...' : 'Trekk Spotify-runde'}
            onPress={drawSpotifyRound}
            disabled={isDrawingRound || isLoadingSpotifyData || playlists.length === 0}
          />
        </View>
      ) : null}

      {currentRound ? (
        <View style={styles.roundCard}>
          <Text style={styles.roundTitle}>Runde klar</Text>
          <Text style={styles.roundPrompt}>{currentRound.prompt}</Text>

          <View style={styles.actionRow}>
            <PrimaryButton
              title="Åpne låt i Spotify"
              onPress={() => Linking.openURL(currentRound.trackUrl)}
              style={styles.actionButton}
            />
            <SecondaryButton
              title={showReveal ? 'Skjul fasit' : 'Vis fasit'}
              onPress={() => setShowReveal((prev) => !prev)}
              style={styles.actionButton}
            />
          </View>

          {showReveal ? <Text style={styles.revealText}>{currentRound.revealText}</Text> : null}
          <Text style={styles.penaltyText}>{currentRound.opponentName} drikker {currentRound.sips} ved feil svar.</Text>
        </View>
      ) : null}

      <View style={styles.voiceTriggerCard}>
        <Text style={styles.voiceTriggerTitle}>Gjett Sangen: auto-stopp på lyd</Text>
        <Text style={styles.voiceTriggerBody}>
          Spill preview i appen. Når noen roper høyt nok, stopper sangen automatisk.
        </Text>

        <View style={styles.actionRow}>
          <PrimaryButton
            title={isListeningForTrigger ? 'Lytter...' : 'Start lydtrigger'}
            onPress={startVoiceStopRound}
            disabled={isListeningForTrigger || !currentRound?.previewUrl}
            style={styles.actionButton}
          />
          <SecondaryButton title="Stopp" onPress={stopRoundManually} style={styles.actionButton} />
        </View>

        <Text style={styles.meterText}>
          {isListeningForTrigger ? 'Lytter etter rop...' : isPreviewPlaying ? 'Spiller preview...' : 'Klar'}
        </Text>
        {!currentRound ? <Text style={styles.warningText}>Trekk en Spotify-runde først.</Text> : null}
        {currentRound && !currentRound.previewUrl ? (
          <Text style={styles.warningText}>Denne låta mangler preview. Trekk en ny runde.</Text>
        ) : null}
      </View>

      {triggerMessage ? <Text style={styles.infoBanner}>{triggerMessage}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <SecondaryButton title="Tilbake til hjem" onPress={() => router.replace('/')} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: '#111A2A99',
    borderColor: '#3A547E88',
    borderWidth: 1,
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
    fontSize: 14,
    lineHeight: 21,
  },
  section: {
    gap: theme.spacing.sm,
    backgroundColor: '#10192A9E',
    borderColor: '#3F5A8488',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  mutedText: {
    color: theme.colors.mutedText,
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: '#111A2A9E',
    borderColor: '#3C5A8788',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  infoTitle: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
  infoText: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  playlistRow: {
    gap: theme.spacing.sm,
    paddingVertical: 4,
  },
  playlistChip: {
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: '#4A638A88',
    backgroundColor: '#17243BC9',
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 140,
    gap: 4,
  },
  playlistChipSelected: {
    borderColor: '#75EAFF',
    backgroundColor: '#19304BCC',
  },
  playlistName: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  playlistNameSelected: {
    color: '#D6F6FF',
  },
  playlistMeta: {
    color: theme.colors.mutedText,
    fontSize: 12,
  },
  roundCard: {
    backgroundColor: '#101A2DAB',
    borderColor: '#48689A88',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  roundTitle: {
    color: theme.colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  roundPrompt: {
    color: theme.colors.text,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 28,
  },
  voiceTriggerCard: {
    marginTop: theme.spacing.xs,
    backgroundColor: '#101A2BD9',
    borderWidth: 1,
    borderColor: '#6A7BA744',
    borderRadius: theme.radius.md,
    padding: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  voiceTriggerTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  voiceTriggerBody: {
    color: theme.colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  meterText: {
    color: '#ACBDE2',
    fontSize: 12,
    fontWeight: '700',
  },
  warningText: {
    color: '#FFD38E',
    fontSize: 12,
    fontWeight: '700',
  },
  revealText: {
    color: theme.colors.accent,
    fontSize: 16,
    fontWeight: '900',
  },
  penaltyText: {
    color: theme.colors.mutedText,
    fontSize: 14,
  },
  infoBanner: {
    color: '#AFFFE4',
    fontSize: 14,
    fontWeight: '700',
  },
  errorText: {
    color: '#FF9AB1',
    fontSize: 14,
    fontWeight: '800',
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
