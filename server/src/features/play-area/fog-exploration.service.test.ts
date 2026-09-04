import { describe, expect, it } from 'vitest';

import { buildExplorationCandidates } from './fog-exploration.service.js';

describe('buildExplorationCandidates', () => {
  it('converts grid reveals into world-space stamps centred on the cell', () => {
    const candidates = buildExplorationCandidates([{ x: 2, y: 3, visionRadius: 6 }], 64);

    expect(candidates).toEqual([{ cellKey: '2:3', x: 160, y: 224, radius: 384 }]);
  });

  it('deduplicates repeat reveals from the same cell', () => {
    const candidates = buildExplorationCandidates(
      [
        { x: 2, y: 3, visionRadius: 6 },
        { x: 2, y: 3, visionRadius: 6 },
      ],
      64,
    );

    expect(candidates).toHaveLength(1);
  });

  it('collapses same-cell emitters onto the widest radius', () => {
    const candidates = buildExplorationCandidates(
      [
        { x: 2, y: 3, visionRadius: 6 },
        { x: 2, y: 3, visionRadius: 12 },
      ],
      64,
    );

    expect(candidates).toEqual([{ cellKey: '2:3', x: 160, y: 224, radius: 768 }]);
  });

  it('snaps positions onto the quantization grid', () => {
    const candidates = buildExplorationCandidates(
      [
        { x: 4, y: 4, visionRadius: 6 },
        { x: 5, y: 5, visionRadius: 6 },
      ],
      64,
      4,
    );

    expect(candidates).toHaveLength(1);
    expect(candidates[0].cellKey).toBe('4:4');
  });

  it('ignores emitters with no vision', () => {
    expect(buildExplorationCandidates([{ x: 1, y: 1, visionRadius: 0 }], 64)).toEqual([]);
  });
});
