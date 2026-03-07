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

export const SPOTIFY_WEB_PKCE_STORAGE_KEY = '@godigassen/spotify-web-pkce';

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

export type SpotifyWebPkceSession = {
  codeVerifier: string;
  state: string;
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
    let detail = '';
    try {
      const payload = (await response.json()) as { error?: string; error_description?: string };
      detail = payload.error_description ?? payload.error ?? '';
    } catch {
      detail = await response.text();
    }

    throw new Error(`Spotify token-feil (${response.status})${detail ? `: ${detail}` : ''}`);
  }

  return (await response.json()) as SpotifyTokenPayload;
}

function randomString(length: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
  let result = '';

  for (const value of bytes) {
    result += alphabet[value % alphabet.length];
  }

  return result;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function spotifyFetch<T>(accessToken: string, path: string): Promise<T> {
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    let detail = '';

    try {
      const payload = (await response.json()) as {
        error?:
          | string
          | {
              status?: number;
              message?: string;
            };
      };

      if (typeof payload.error === 'string') {
        detail = payload.error;
      } else if (payload.error?.message) {
        detail = payload.error.message;
      }
    } catch {
      detail = await response.text();
    }

    if (response.status === 401) {
      throw new Error(`Spotify API-feil (401): token er ugyldig eller utløpt${detail ? ` - ${detail}` : ''}`);
    }

    if (response.status === 403) {
      throw new Error(
        `Spotify API-feil (403): tilgang nektet${detail ? ` - ${detail}` : ''}. Sjekk Spotify app settings og testbruker.`
      );
    }

    throw new Error(`Spotify API-feil (${response.status})${detail ? `: ${detail}` : ''}`);
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
  const data = await spotifyFetch<{
    items?: Array<
      | {
          id?: string | null;
          name?: string | null;
          tracks?: {
            total?: number | null;
          } | null;
        }
      | null
    >;
  }>(
    accessToken,
    `/me/playlists?limit=${limit}`
  );

  return (data.items ?? [])
    .filter((item): item is NonNullable<NonNullable<typeof data.items>[number]> => {
      return !!item && typeof item.id === 'string' && typeof item.name === 'string';
    })
    .map((item) => ({
      id: item.id!,
      name: item.name!,
      tracks: {
        total: typeof item.tracks?.total === 'number' ? item.tracks.total : 0,
      },
    }));
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

export async function createSpotifyWebPkceSession(): Promise<SpotifyWebPkceSession & { codeChallenge: string }> {
  const codeVerifier = randomString(64);
  const state = randomString(24);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier));
  const codeChallenge = base64UrlEncode(new Uint8Array(digest));

  return {
    codeVerifier,
    state,
    codeChallenge,
  };
}

export function buildSpotifyAuthorizationUrl(input: {
  clientId: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    response_type: 'code',
    redirect_uri: input.redirectUri,
    code_challenge_method: 'S256',
    code_challenge: input.codeChallenge,
    state: input.state,
    scope: input.scopes.join(' '),
  });

  return `${spotifyDiscovery.authorizationEndpoint}?${params.toString()}`;
}

export async function exchangeSpotifyCodeForToken(input: {
  clientId: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<SpotifyAuthState> {
  const payload = await postSpotifyToken({
    client_id: input.clientId,
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.codeVerifier,
  });

  return normalizeTokenPayload(payload);
}
