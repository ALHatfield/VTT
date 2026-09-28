import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DiceOverlay } from './DiceOverlay';

const mockScene = {
  roll: vi.fn(),
  clear: vi.fn(),
  setCameraControlsEnabled: vi.fn(),
  dispose: vi.fn(),
  isRolling: vi.fn(() => false),
};

const mockDiceSceneCtor = vi.fn(() => mockScene);

vi.mock('@vtt/dice', () => ({
  DiceScene: vi.fn((...args: unknown[]) => mockDiceSceneCtor(...(args as []))),
  MAX_CONCURRENT_DICE: 8,
  createStandardDie: vi.fn((sides: number) => ({
    id: `d${String(sides)}`,
    name: `d${String(sides)}`,
    sides,
    faces: Array.from({ length: sides }, (_, i) => String(i + 1)),
  })),
}));

describe('DiceOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDiceSceneCtor.mockImplementation(() => mockScene);
  });

  it('renders a pointer-transparent overlay with a canvas', () => {
    render(
      <DiceOverlay pendingRolls={[]} onRollComplete={vi.fn()} cameraControlsEnabled={false} />,
    );
    const overlay = screen.getByTestId('dice-overlay');
    expect(overlay).toBeInTheDocument();
    expect(overlay.querySelector('canvas')).not.toBeNull();
    expect(overlay.className).not.toContain('interactive');
  });

  it('captures the pointer when dev camera controls are enabled', () => {
    render(
      <DiceOverlay pendingRolls={[]} onRollComplete={vi.fn()} cameraControlsEnabled={true} />,
    );
    expect(screen.getByTestId('dice-overlay').className).toContain('interactive');
  });

  it('plays a pending roll with server-authoritative face indices', async () => {
    render(
      <DiceOverlay
        pendingRolls={[
          { rollId: 'roll-1', dice: [{ sides: 20, value: 14 }], rollerName: 'Tester' },
        ]}
        onRollComplete={vi.fn()}
        cameraControlsEnabled={false}
      />,
    );

    await waitFor(() => {
      expect(mockScene.roll).toHaveBeenCalledTimes(1);
    });
    const [rollId, dice, options] = mockScene.roll.mock.calls[0] as [
      string,
      Array<{ definition: { sides: number }; faceIndex: number }>,
      { label?: string },
    ];
    expect(rollId).toBe('roll-1');
    expect(dice).toHaveLength(1);
    // value 14 on a d20 → faceIndex 13 (faces are "1".."20")
    expect(dice[0].faceIndex).toBe(13);
    expect(dice[0].definition.sides).toBe(20);
    // The roller's name is passed through as the dice name tag
    expect(options.label).toBe('Tester');
  });

  it('does not play the same roll twice when it arrives before the animator resolves', async () => {
    const { rerender } = render(
      <DiceOverlay
        pendingRolls={[{ rollId: 'roll-1', dice: [{ sides: 6, value: 4 }], rollerName: 'Tester' }]}
        onRollComplete={vi.fn()}
        cameraControlsEnabled={false}
      />,
    );

    await waitFor(() => {
      expect(mockScene.roll).toHaveBeenCalledTimes(1);
    });

    // Re-render with the same pendingRolls — must not re-throw
    rerender(
      <DiceOverlay
        pendingRolls={[{ rollId: 'roll-1', dice: [{ sides: 6, value: 4 }], rollerName: 'Tester' }]}
        onRollComplete={vi.fn()}
        cameraControlsEnabled={false}
      />,
    );
    expect(mockScene.roll).toHaveBeenCalledTimes(1);
  });

  it('plays concurrent rolls from different players as separate throws', async () => {
    const { rerender } = render(
      <DiceOverlay
        pendingRolls={[{ rollId: 'roll-1', dice: [{ sides: 20, value: 14 }], rollerName: 'Alice' }]}
        onRollComplete={vi.fn()}
        cameraControlsEnabled={false}
      />,
    );

    await waitFor(() => {
      expect(mockScene.roll).toHaveBeenCalledTimes(1);
    });

    // A second player's roll arrives while the first is still animating
    rerender(
      <DiceOverlay
        pendingRolls={[
          { rollId: 'roll-1', dice: [{ sides: 20, value: 14 }], rollerName: 'Alice' },
          { rollId: 'roll-2', dice: [{ sides: 6, value: 3 }], rollerName: 'Bob' },
        ]}
        onRollComplete={vi.fn()}
        cameraControlsEnabled={false}
      />,
    );

    expect(mockScene.roll).toHaveBeenCalledTimes(2);
    const secondCall = mockScene.roll.mock.calls[1] as [string, unknown, { label?: string }];
    expect(secondCall[0]).toBe('roll-2');
    expect(secondCall[2].label).toBe('Bob');
  });

  it('disposes the animator on unmount', async () => {
    const { unmount } = render(
      <DiceOverlay pendingRolls={[]} onRollComplete={vi.fn()} cameraControlsEnabled={false} />,
    );
    // Wait for the real animator creation to resolve before unmounting
    await waitFor(() => {
      expect(mockDiceSceneCtor).toHaveBeenCalled();
    });
    unmount();
    await waitFor(() => {
      expect(mockScene.dispose).toHaveBeenCalled();
    });
  });

  it('signals onAnimatorError when animator creation fails', async () => {
    mockDiceSceneCtor.mockImplementation(() => {
      throw new Error('WebGL init failed');
    });
    const onAnimatorError = vi.fn();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    render(
      <DiceOverlay
        pendingRolls={[]}
        onRollComplete={vi.fn()}
        onAnimatorError={onAnimatorError}
        cameraControlsEnabled={false}
      />,
    );

    await waitFor(() => {
      expect(onAnimatorError).toHaveBeenCalledTimes(1);
    });
    consoleSpy.mockRestore();
  });
});
