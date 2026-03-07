import * as AuthSession from 'expo-auth-session';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomDock } from '@/src/components/BottomDock';
import { PartyLogo } from '@/src/components/PartyLogo';
import { PrimaryButton } from '@/src/components/PrimaryButton';
import { ScreenContainer } from '@/src/components/ScreenContainer';
import { SecondaryButton } from '@/src/components/SecondaryButton';
import { theme } from '@/src/constants/theme';
import { useGameSession } from '@/src/context/GameSessionContext';
import { createMusicRound, MusicRound } from '@/src/game/musicEngine';
import {
  buildSpotifyAuthorizationUrl,
  clearSpotifyAuth,
  createSpotifyWebPkceSession,
  ensureSpotifyAuth,
  exchangeSpotifyCodeForToken,
  fetchSpotifyPlaylistTracks,
  fetchSpotifyPlaylists,
  fetchSpotifyUser,
  getSpotifyClientId,
  loadSpotifyAuth,
  pickRandomSpotifyTrack,
  saveSpotifyAuth,
  SPOTIFY_WEB_PKCE_STORAGE_KEY,
  spotifyDiscovery,
  spotifyScopes,
  SpotifyAuthState,
  SpotifyPlaylist,
  SpotifyUser,
  SpotifyWebPkceSession,
} from '@/src/music/spotify';

WebBrowser.maybeCompleteAuthSession();

export default function GuessSongScreen() {
  const router = useRouter();
  const { players } = useGameSession();

  const clientId = getSpotifyClientId();

  // Spotify only allows http://127.0.0.1:* as redirect URI (not localhost).
  // Redirect so sessionStorage and redirect URI share the same origin.
  useEffect(() => {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    ) {
      window.location.replace(
        window.location.href.replace('localhost', '127.0.0.1')
      );
    }
  }, []);

  const redirectUri = useMemo(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      return window.location.origin.replace('localhost', '127.0.0.1');
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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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

    void hydrateSpotify();

    return () => {
      mounted = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !clientId || typeof window === 'undefined') {
      return;
    }

    const code = new URLSearchParams(window.location.search).get('code');
    const state = new URLSearchParams(window.location.search).get('state');
    if (!code) {
      return;
    }

    let mounted = true;

    const finishWebAuth = async () => {
      setIsConnecting(true);
      setErrorMessage(null);

      try {
        const raw = window.sessionStorage.getItem(SPOTIFY_WEB_PKCE_STORAGE_KEY);
        if (!raw) {
          throw new Error('Mangler Spotify PKCE-session. Start Spotify-innlogging på nytt.');
        }

        const pkce = JSON.parse(raw) as SpotifyWebPkceSession;
        if (!pkce.codeVerifier || !pkce.state) {
          throw new Error('Spotify PKCE-session er ugyldig. Start innlogging på nytt.');
        }
        if (state !== pkce.state) {
          throw new Error('Spotify state matcher ikke. Start innlogging på nytt.');
        }

        const nextAuth = await exchangeSpotifyCodeForToken({
          clientId,
          code,
          redirectUri,
          codeVerifier: pkce.codeVerifier,
        });

        await saveSpotifyAuth(nextAuth);
        window.sessionStorage.removeItem(SPOTIFY_WEB_PKCE_STORAGE_KEY);
        window.history.replaceState({}, '', '/guess-song');

        if (mounted) {
          setAuthState(nextAuth);
          setInfoMessage('Spotify er koblet til.');
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

    void finishWebAuth();

    return () => {
      mounted = false;
    };
  }, [clientId, redirectUri]);

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

    void loadSpotifyData();

    return () => {
      mounted = false;
    };
  }, [authState, clientId, ensureFreshAuth]);

  const connectSpotify = async () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      setErrorMessage('Spotify-weblogin er kun satt opp for web akkurat nå.');
      return;
    }

    if (!clientId) {
      setErrorMessage('Mangler EXPO_PUBLIC_SPOTIFY_CLIENT_ID.');
      return;
    }

    try {
      setErrorMessage(null);
      setInfoMessage(null);
      setIsConnecting(false);
      const pkce = await createSpotifyWebPkceSession();
      window.sessionStorage.setItem(
        SPOTIFY_WEB_PKCE_STORAGE_KEY,
        JSON.stringify({
          codeVerifier: pkce.codeVerifier,
          state: pkce.state,
        } satisfies SpotifyWebPkceSession)
      );

      const authUrl = buildSpotifyAuthorizationUrl({
        clientId,
        redirectUri,
        scopes: spotifyScopes,
        codeChallenge: pkce.codeChallenge,
        state: pkce.state,
      });

      window.location.assign(authUrl);
    } catch (error) {
      setIsConnecting(false);
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke starte Spotify-innlogging.');
    }
  };

  const disconnectSpotify = async () => {
    await clearSpotifyAuth();
    setAuthState(null);
    setUser(null);
    setPlaylists([]);
    setSelectedPlaylistId(null);
    setCurrentRound(null);
    setShowReveal(false);
    setInfoMessage('Spotify ble koblet fra.');
    setErrorMessage(null);
  };

  const drawSpotifyRound = async () => {
    if (!selectedPlaylistId) {
      setErrorMessage('Velg en spilleliste først.');
      return;
    }

    setIsDrawingRound(true);
    setErrorMessage(null);
    setInfoMessage(null);

    try {
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
      setShowReveal(false);
      setInfoMessage('Ny sang trukket. Bruk Spotify for å spille av låta.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Kunne ikke trekke låt fra Spotify.');
    } finally {
      setIsDrawingRound(false);
    }
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
        <Text style={styles.title}>Gjett Sangen</Text>
        <Text style={styles.subtitle}>
          Koble til Spotify, velg spilleliste og trekk en låt. Spill av i Spotify og la gruppa gjette.
        </Text>
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
              disabled={isConnecting}
              style={styles.actionButton}
            />
            <SecondaryButton title="Koble fra" onPress={disconnectSpotify} style={styles.actionButton} />
          </View>
        </View>
      )}

      {authState && !clientIdMissing ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spilleliste</Text>
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

          <Text style={styles.mutedText}>Velg én spilleliste og trekk deretter en tilfeldig låt.</Text>
          <PrimaryButton
            title={isDrawingRound ? 'Trekker låt...' : 'Trekk låt'}
            onPress={drawSpotifyRound}
            disabled={isDrawingRound || isLoadingSpotifyData || playlists.length === 0}
          />
        </View>
      ) : null}

      {currentRound ? (
        <View style={styles.roundCard}>
          <Text style={styles.roundTitle}>Runde klar</Text>
          <Text style={styles.roundPrompt}>{currentRound.prompt}</Text>
          <Text style={styles.penaltyText}>{currentRound.opponentName} drikker {currentRound.sips} ved feil svar.</Text>

          <View style={styles.actionRow}>
            <PrimaryButton
              title="Åpne i Spotify"
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
        </View>
      ) : null}

      {infoMessage ? <Text style={styles.infoBanner}>{infoMessage}</Text> : null}
      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <BottomDock>
        <SecondaryButton title="Tilbake til hjem" onPress={() => router.replace('/')} />
      </BottomDock>
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
    fontSize: 28,
    fontWeight: '900',
  },
  subtitle: {
    color: theme.colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
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
    lineHeight: 20,
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
    lineHeight: 26,
  },
  penaltyText: {
    color: '#A8B7D6',
    fontSize: 14,
    fontWeight: '700',
  },
  revealText: {
    color: '#B9FFF2',
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 26,
  },
  infoBanner: {
    color: '#B9FFF2',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    color: '#FF9FB0',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
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
