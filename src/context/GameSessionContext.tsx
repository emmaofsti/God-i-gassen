import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { GameMode, Player, PlayerSound } from '@/src/types/game';

const PLAYERS_STORAGE_KEY = '@godigassen/players';
const PLAYER_SOUNDS_STORAGE_KEY = '@godigassen/player-sounds';
const MAX_PLAYERS = 12;

type GameSessionContextValue = {
  players: Player[];
  playerSounds: Record<string, PlayerSound>;
  mode: GameMode;
  isHydrated: boolean;
  addPlayer: (name: string) => void;
  removePlayer: (playerId: string) => void;
  movePlayer: (playerId: string, direction: 'up' | 'down') => void;
  setPlayerSound: (playerId: string, sound: PlayerSound) => void;
  removePlayerSound: (playerId: string) => void;
  setMode: (mode: GameMode) => void;
  resetPlayers: () => void;
};

const GameSessionContext = createContext<GameSessionContextValue | undefined>(undefined);

function createPlayer(name: string): Player {
  return {
    id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    name,
  };
}

function sanitizePlayers(input: unknown): Player[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .filter((entry) => typeof entry?.name === 'string' && typeof entry?.id === 'string')
    .map((entry) => ({ id: entry.id, name: entry.name.trim() }))
    .filter((entry) => entry.name.length > 0)
    .slice(0, MAX_PLAYERS);
}

function sanitizePlayerSounds(
  input: unknown,
  validPlayerIds: Set<string>
): Record<string, PlayerSound> {
  if (!input || typeof input !== 'object') {
    return {};
  }

  const raw = input as Record<string, PlayerSound>;
  const result: Record<string, PlayerSound> = {};

  for (const [playerId, sound] of Object.entries(raw)) {
    if (!validPlayerIds.has(playerId)) {
      continue;
    }

    if (!sound || typeof sound.uri !== 'string' || typeof sound.createdAt !== 'number') {
      continue;
    }

    result[playerId] = {
      uri: sound.uri,
      createdAt: sound.createdAt,
      durationMs: typeof sound.durationMs === 'number' ? sound.durationMs : undefined,
    };
  }

  return result;
}

export function GameSessionProvider({ children }: PropsWithChildren) {
  const [players, setPlayers] = useState<Player[]>([]);
  const [playerSounds, setPlayerSounds] = useState<Record<string, PlayerSound>>({});
  const [mode, setMode] = useState<GameMode>('cards');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;

    const hydrateSession = async () => {
      try {
        const [rawPlayers, rawSounds] = await Promise.all([
          AsyncStorage.getItem(PLAYERS_STORAGE_KEY),
          AsyncStorage.getItem(PLAYER_SOUNDS_STORAGE_KEY),
        ]);

        const parsedPlayers = rawPlayers ? (JSON.parse(rawPlayers) as unknown) : [];
        const sanitizedPlayers = sanitizePlayers(parsedPlayers);
        const playerIds = new Set(sanitizedPlayers.map((player) => player.id));

        const parsedSounds = rawSounds ? (JSON.parse(rawSounds) as unknown) : {};
        const sanitizedSounds = sanitizePlayerSounds(parsedSounds, playerIds);

        if (mounted) {
          setPlayers(sanitizedPlayers);
          setPlayerSounds(sanitizedSounds);
        }
      } catch {
        // Hvis persistering feiler, fortsetter appen med tom state.
      } finally {
        if (mounted) {
          setIsHydrated(true);
        }
      }
    };

    hydrateSession();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    AsyncStorage.setItem(PLAYERS_STORAGE_KEY, JSON.stringify(players)).catch(() => {
      // Ignorer feil i lagring for å unngå å blokkere UI.
    });
  }, [isHydrated, players]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    AsyncStorage.setItem(PLAYER_SOUNDS_STORAGE_KEY, JSON.stringify(playerSounds)).catch(() => {
      // Ignorer feil i lagring for å unngå å blokkere UI.
    });
  }, [isHydrated, playerSounds]);

  useEffect(() => {
    const validIds = new Set(players.map((player) => player.id));

    setPlayerSounds((prev) => {
      let changed = false;
      const next: Record<string, PlayerSound> = {};

      for (const [playerId, sound] of Object.entries(prev)) {
        if (!validIds.has(playerId)) {
          changed = true;
          continue;
        }
        next[playerId] = sound;
      }

      return changed ? next : prev;
    });
  }, [players]);

  const value = useMemo<GameSessionContextValue>(() => {
    return {
      players,
      playerSounds,
      mode,
      isHydrated,
      addPlayer: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) {
          return;
        }

        setPlayers((prev) => {
          if (prev.length >= MAX_PLAYERS) {
            return prev;
          }
          return [...prev, createPlayer(trimmed)];
        });
      },
      removePlayer: (playerId: string) => {
        setPlayers((prev) => prev.filter((player) => player.id !== playerId));
        setPlayerSounds((prev) => {
          if (!prev[playerId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      },
      movePlayer: (playerId: string, direction: 'up' | 'down') => {
        setPlayers((prev) => {
          const index = prev.findIndex((player) => player.id === playerId);
          if (index < 0) {
            return prev;
          }

          const targetIndex = direction === 'up' ? index - 1 : index + 1;
          if (targetIndex < 0 || targetIndex >= prev.length) {
            return prev;
          }

          const copy = [...prev];
          [copy[index], copy[targetIndex]] = [copy[targetIndex]!, copy[index]!];
          return copy;
        });
      },
      setPlayerSound: (playerId: string, sound: PlayerSound) => {
        setPlayerSounds((prev) => ({ ...prev, [playerId]: sound }));
      },
      removePlayerSound: (playerId: string) => {
        setPlayerSounds((prev) => {
          if (!prev[playerId]) {
            return prev;
          }
          const next = { ...prev };
          delete next[playerId];
          return next;
        });
      },
      setMode,
      resetPlayers: () => {
        setPlayers([]);
        setPlayerSounds({});
      },
    };
  }, [isHydrated, mode, playerSounds, players]);

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
}

export function useGameSession() {
  const context = useContext(GameSessionContext);
  if (!context) {
    throw new Error('useGameSession må brukes inne i GameSessionProvider.');
  }
  return context;
}

export const sessionLimits = {
  minimumPlayers: 2,
  maximumPlayers: MAX_PLAYERS,
};
