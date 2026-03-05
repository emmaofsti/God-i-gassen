import { CardTemplate, Player, RenderedCard } from '@/src/types/game';

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

export function pickRandomPlayer(players: Player[], excludePlayerId?: string): Player {
  const filteredPlayers = excludePlayerId
    ? players.filter((player) => player.id !== excludePlayerId)
    : players;

  if (filteredPlayers.length === 0) {
    throw new Error('Ingen spillere tilgjengelig for valg.');
  }

  return filteredPlayers[pickRandomIndex(filteredPlayers.length)]!;
}

export function renderCardTemplate(template: CardTemplate, players: Player[]): string {
  if (players.length < 2) {
    throw new Error('Minst 2 spillere kreves for å rendre kort.');
  }

  const player = pickRandomPlayer(players);
  const player2 = pickRandomPlayer(players, player.id);
  const sips = template.params
    ? randomInt(template.params.minSips, template.params.maxSips)
    : randomInt(1, 3);

  return template.templateText
    .replaceAll('{player}', player.name)
    .replaceAll('{player2}', player2.name)
    .replaceAll('{sips}', String(sips));
}

export function drawRenderedCard(deck: CardTemplate[], players: Player[]): RenderedCard {
  if (deck.length === 0) {
    throw new Error('Kortstokken er tom.');
  }

  const card = deck[pickRandomIndex(deck.length)]!;
  return {
    id: card.id,
    category: card.category,
    renderedText: renderCardTemplate(card, players),
  };
}
