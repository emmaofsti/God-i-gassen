import { pickRandomPlayer } from '@/src/game/cardEngine';
import { Player } from '@/src/types/game';

export type MusicTrack = {
  id: string;
  name: string;
  artists: string[];
  spotifyUrl: string;
  previewUrl: string | null;
};

export type MusicRound = {
  id: string;
  playerName: string;
  opponentName: string;
  prompt: string;
  revealText: string;
  sips: number;
  trackUrl: string;
  previewUrl: string | null;
};

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickChallengeType(): 'guess-artist' | 'guess-title' {
  return Math.random() > 0.5 ? 'guess-artist' : 'guess-title';
}

export function createMusicRound(track: MusicTrack, players: Player[]): MusicRound {
  if (players.length < 2) {
    throw new Error('Minst 2 spillere trengs for Music Game.');
  }

  const dj = pickRandomPlayer(players);
  const opponent = pickRandomPlayer(players, dj.id);
  const sips = randomInt(1, 4);
  const challengeType = pickChallengeType();

  const prompt =
    challengeType === 'guess-artist'
      ? `${dj.name} er DJ. ${opponent.name} må gjette ARTIST. Feil svar: ${sips} slurker.`
      : `${dj.name} er DJ. ${opponent.name} må gjette LÅTTITTEL. Feil svar: ${sips} slurker.`;

  return {
    id: `${track.id}-${Date.now()}`,
    playerName: dj.name,
    opponentName: opponent.name,
    prompt,
    revealText: `${track.name} - ${track.artists.join(', ')}`,
    sips,
    trackUrl: track.spotifyUrl,
    previewUrl: track.previewUrl,
  };
}
