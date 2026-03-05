import AsyncStorage from '@react-native-async-storage/async-storage';

const SPOTIFY_AUTH_STORAGE_KEY = '@godigassen/spotify-auth';

export const spotifyDiscovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export const spotifyScopes = [
  'user-read-private',
  'user-read-email',
  'playlist-read-private',
  'playlist-read-collaborative',
];

export type SpotifyAuthState = {
  accessToken: string;
  tokenType: string;
  expiresAt: number;
  refreshToken?: string;
};

export type SpotifyUser = {
  id: string;
  display_name: string | null;
  email?: string;
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  tracks: {
    total: number;
  };
};

export type SpotifyTrack = {
  id: string;
  name: string;
  artists: string[];
  spotifyUrl: string;
  previewUrl: string | null;
};

type SpotifyTokenPayload = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
};

type SpotifyPlaylistTrackResponse = {
  items: Array<{
    track: {
      id: string | null;
      name: string;
      preview_url: string | null;
      is_local: boolean;
      external_urls?: { spotify?: string };
      artists: Array<{ name: string }>;
    } | null;
  }>;
};

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

export function getSpotifyClientId(): string {
  return process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_ID ?? '';
}

export function isAuthExpired(authState: SpotifyAuthState, skewMs = 60_000): boolean {
  return Date.now() + skewMs >= authState.expiresAt;
}

function normalizeTokenPayload(
  payload: SpotifyTokenPayload,
  previousRefreshToken?: string
): SpotifyAuthState {
  return {
    accessToken: payload.access_token,
    tokenType: payload.token_type,
    refreshToken: payload.refresh_token ?? previousRefreshToken,
    expiresAt: Date.now() + payload.expires_in * 1000,
  };
}

async function postSpotifyToken(
  body: Record<string, string>
): Promise<SpotifyTokenPayload> {
  const params = new URLSearchParams(body);
  const response = await fetch(spotifyDiscovery.tokenEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Spotify token-feil (${response.status})`);
  }

  return (await response.json()) as SpotifyTokenPayload;
}

async function spotifyFetch<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Spotify API-feil (${response.status})`);
  }

  return (await response.json()) as T;
}

export async function saveSpotifyAuth(authState: SpotifyAuthState): Promise<void> {
  await AsyncStorage.setItem(SPOTIFY_AUTH_STORAGE_KEY, JSON.stringify(authState));
}

export async function loadSpotifyAuth(): Promise<SpotifyAuthState | null> {
  const raw = await AsyncStorage.getItem(SPOTIFY_AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as SpotifyAuthState;
    if (!parsed.accessToken || typeof parsed.expiresAt !== 'number') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function clearSpotifyAuth(): Promise<void> {
  await AsyncStorage.removeItem(SPOTIFY_AUTH_STORAGE_KEY);
}

export async function refreshSpotifyAuth(
  refreshToken: string,
  clientId: string
): Promise<SpotifyAuthState> {
  const payload = await postSpotifyToken({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });

  return normalizeTokenPayload(payload, refreshToken);
}

export async function ensureSpotifyAuth(
  authState: SpotifyAuthState,
  clientId: string
): Promise<SpotifyAuthState> {
  if (!isAuthExpired(authState)) {
    return authState;
  }

  if (!authState.refreshToken) {
    throw new Error('Spotify-innlogging har utløpt. Koble til igjen.');
  }

  const refreshed = await refreshSpotifyAuth(authState.refreshToken, clientId);
  await saveSpotifyAuth(refreshed);
  return refreshed;
}

export async function fetchSpotifyUser(accessToken: string): Promise<SpotifyUser> {
  return spotifyFetch<SpotifyUser>(accessToken, '/me');
}

export async function fetchSpotifyPlaylists(
  accessToken: string,
  limit = 20
): Promise<SpotifyPlaylist[]> {
  const data = await spotifyFetch<{ items: SpotifyPlaylist[] }>(
    accessToken,
    `/me/playlists?limit=${limit}`
  );
  return data.items;
}

export async function fetchSpotifyPlaylistTracks(
  accessToken: string,
  playlistId: string,
  limit = 50
): Promise<SpotifyTrack[]> {
  const data = await spotifyFetch<SpotifyPlaylistTrackResponse>(
    accessToken,
    `/playlists/${playlistId}/tracks?limit=${limit}`
  );

  return data.items
    .map((entry) => entry.track)
    .filter((track): track is NonNullable<SpotifyPlaylistTrackResponse['items'][number]['track']> => {
      return !!track && !track.is_local && !!track.id && !!track.external_urls?.spotify;
    })
    .map((track) => ({
      id: track.id!,
      name: track.name,
      artists: track.artists.map((artist) => artist.name),
      spotifyUrl: track.external_urls!.spotify!,
      previewUrl: track.preview_url,
    }));
}

export function pickRandomSpotifyTrack(tracks: SpotifyTrack[]): SpotifyTrack {
  if (tracks.length === 0) {
    throw new Error('Fant ingen spor i spillelisten.');
  }

  return tracks[randomIndex(tracks.length)]!;
}

export function toStoredAuthFromTokenPayload(
  payload: {
    accessToken: string;
    tokenType: string;
    expiresIn?: number;
    refreshToken?: string;
  },
  previousRefreshToken?: string
): SpotifyAuthState {
  return {
    accessToken: payload.accessToken,
    tokenType: payload.tokenType,
    expiresAt: Date.now() + (payload.expiresIn ?? 3600) * 1000,
    refreshToken: payload.refreshToken ?? previousRefreshToken,
  };
}
