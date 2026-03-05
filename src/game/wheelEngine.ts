import { WheelSegment } from '@/src/types/game';

export type WheelSpinResult = {
  index: number;
  segment: WheelSegment;
  rotationDeg: number;
};

function randomIndex(length: number): number {
  return Math.floor(Math.random() * length);
}

export function spinWheelResult(
  segments: WheelSegment[],
  minimumFullTurns = 4,
  maximumFullTurns = 7
): WheelSpinResult {
  if (segments.length === 0) {
    throw new Error('Hjulet mangler segmenter.');
  }

  const index = randomIndex(segments.length);
  const segmentAngle = 360 / segments.length;
  const centerOffset = segmentAngle / 2;
  const baseTarget = 360 - index * segmentAngle - centerOffset;
  const fullTurns =
    minimumFullTurns + randomIndex(maximumFullTurns - minimumFullTurns + 1);

  return {
    index,
    segment: segments[index]!,
    rotationDeg: fullTurns * 360 + baseTarget,
  };
}
