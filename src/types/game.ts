export type GameMode = 'cards' | 'wheel' | 'guess-song' | 'music';

export type CardCategory = 'drink' | 'give' | 'everyone' | 'rule' | 'challenge' | 'social';

export type Player = {
  id: string;
  name: string;
};

export type PlayerSound = {
  uri: string;
  createdAt: number;
  durationMs?: number;
};

export type CardParams = {
  minSips: number;
  maxSips: number;
};

export type CardTemplate = {
  id: string;
  category: CardCategory;
  templateText: string;
  params?: CardParams;
};

export type RenderedCard = {
  id: string;
  category: CardCategory;
  renderedText: string;
};

export type WheelSegment = {
  id: string;
  label: string;
  ruleText: string;
};
