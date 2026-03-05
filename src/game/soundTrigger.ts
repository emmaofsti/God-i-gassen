export type SoundTriggerConfig = {
  thresholdDb: number;
  requiredHits: number;
};

export type SoundTriggerState = {
  consecutiveHits: number;
};

export const defaultSoundTriggerConfig: SoundTriggerConfig = {
  thresholdDb: -16,
  requiredHits: 2,
};

export function createInitialSoundTriggerState(): SoundTriggerState {
  return { consecutiveHits: 0 };
}

export function evaluateSoundTrigger(
  state: SoundTriggerState,
  meteringDb: number,
  config: SoundTriggerConfig = defaultSoundTriggerConfig
): { nextState: SoundTriggerState; triggered: boolean } {
  if (Number.isNaN(meteringDb)) {
    return {
      nextState: { consecutiveHits: 0 },
      triggered: false,
    };
  }

  const hit = meteringDb >= config.thresholdDb;
  const nextHits = hit ? state.consecutiveHits + 1 : 0;

  return {
    nextState: { consecutiveHits: nextHits },
    triggered: nextHits >= config.requiredHits,
  };
}
