import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type { Token } from '@vtt/shared';

import { TokenHoverCard } from './TokenHoverCard';

// Suppress GSAP "from" call in tests — no animation needed
vi.mock('gsap', () => ({
  default: { from: vi.fn(), to: vi.fn(), killTweensOf: vi.fn() },
}));
vi.mock('@gsap/react', () => ({
  useGSAP: (fn: () => void) => fn(),
}));

function makeToken(overrides: Partial<Token> = {}): Token {
  return {
    id: 'tok-1',
    name: 'Gandalf',
    type: 'player',
    x: 2,
    y: 3,
    size: 1,
    color: '#4488ff',
    hp: 30,
    maxHp: 40,
    ac: 15,
    visionRadius: 6,
    auraRadius: null,
    auraColor: null,
    auraVisible: false,
    auraType: null,
    auraCondition: null,
    iconUrl: null,
    ownerId: 'user-1',
    ownerName: 'Gandalf',
    sceneId: 'scene-1',
    campaignId: 'campaign-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    npcSubtype: null,
    ...overrides,
  };
}

function makeWrapperRef(): React.RefObject<HTMLDivElement> {
  const wrapperRef = createRef<HTMLDivElement>();
  const div = document.createElement('div');
  Object.defineProperty(div, 'clientWidth', { value: 900, configurable: true });
  Object.defineProperty(div, 'clientHeight', { value: 600, configurable: true });
  (wrapperRef as { current: HTMLDivElement }).current = div;
  return wrapperRef;
}

function renderCard(
  token: Token,
  {
    isSelected = false,
    canEditHP = false,
    canRoll = true,
    canvasX = 400,
    canvasY = 300,
    onHPChange = vi.fn(),
    canEditVisionRadius = false,
    onAuraChange = vi.fn(),
  }: {
    isSelected?: boolean;
    canEditHP?: boolean;
    canRoll?: boolean;
    canvasX?: number;
    canvasY?: number;
    onHPChange?: (tokenId: string, hp: number) => void;
    canEditVisionRadius?: boolean;
    onAuraChange?: Parameters<typeof TokenHoverCard>[0]['onAuraChange'];
  } = {},
): ReturnType<typeof render> {
  return render(
    <TokenHoverCard
      token={token}
      canvasX={canvasX}
      canvasY={canvasY}
      isSelected={isSelected}
      canEditHP={canEditHP}
      canRoll={canRoll}
      canEditVisionRadius={canEditVisionRadius}
      onClose={vi.fn()}
      onHPChange={onHPChange}
      onAuraChange={onAuraChange}
      canvasWrapperRef={makeWrapperRef()}
    />,
  );
}

// ---------------------------------------------------------------------------

describe('TokenHoverCard', () => {
  describe('HP bar colour classes', () => {
    it('applies healthy class when HP is at full (100%)', () => {
      const { container } = renderCard(makeToken({ hp: 40, maxHp: 40 }));
      expect(container.querySelector('[class*="healthy"]')).toBeTruthy();
    });

    it('applies healthy class when HP is exactly 75%', () => {
      const { container } = renderCard(makeToken({ hp: 30, maxHp: 40 }));
      expect(container.querySelector('[class*="healthy"]')).toBeTruthy();
    });

    it('applies wounded class when HP is between 25% and 74%', () => {
      const { container } = renderCard(makeToken({ hp: 20, maxHp: 40 }));
      expect(container.querySelector('[class*="wounded"]')).toBeTruthy();
    });

    it('applies critical class when HP is below 25% but above 0%', () => {
      const { container } = renderCard(makeToken({ hp: 5, maxHp: 40 }));
      expect(container.querySelector('[class*="critical"]')).toBeTruthy();
    });

    it('applies dead class when HP is 0', () => {
      const { container } = renderCard(makeToken({ hp: 0, maxHp: 40 }));
      expect(container.querySelector('[class*="dead"]')).toBeTruthy();
    });

    it('renders no HP bar when maxHp is null', () => {
      const { container } = renderCard(makeToken({ hp: null, maxHp: null }));
      expect(container.querySelector('[class*="hpBar"]')).toBeFalsy();
    });
  });

  describe('hover vs selected state', () => {
    it('applies hover class when not selected', () => {
      const { container } = renderCard(makeToken(), { isSelected: false });
      expect(container.querySelector('[class*="hover"]')).toBeTruthy();
      expect(container.querySelector('[class*="selected"]')).toBeFalsy();
    });

    it('applies selected class when selected', () => {
      const { container } = renderCard(makeToken(), { isSelected: true });
      expect(container.querySelector('[class*="selected"]')).toBeTruthy();
      expect(container.querySelector('[class*="hover"]')).toBeFalsy();
    });

    it('shows close button only when selected', () => {
      const { rerender } = renderCard(makeToken(), { isSelected: false });
      expect(screen.queryByLabelText('Close')).not.toBeInTheDocument();

      rerender(
        <TokenHoverCard
          token={makeToken()}
          canvasX={400}
          canvasY={300}
          isSelected
          canEditHP={false}
          onClose={vi.fn()}
          onHPChange={vi.fn()}
          canvasWrapperRef={makeWrapperRef()}
        />,
      );
      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });

    it('shows quick-roll buttons only when selected', () => {
      renderCard(makeToken(), { isSelected: true });
      expect(screen.getByText('Attack')).toBeInTheDocument();
      expect(screen.getByText('Damage')).toBeInTheDocument();
    });

    it('does not show quick-roll buttons when not selected', () => {
      renderCard(makeToken(), { isSelected: false });
      expect(screen.queryByText('Attack')).not.toBeInTheDocument();
    });

    it('hides quick-roll buttons when canRoll is false (observer view)', () => {
      renderCard(makeToken(), { isSelected: true, canRoll: false });
      expect(screen.queryByText('Attack')).not.toBeInTheDocument();
      expect(screen.queryByText('Damage')).not.toBeInTheDocument();
    });
  });

  describe('aura controls', () => {
    it('shows aura controls only for selected DM-editable tokens', () => {
      renderCard(makeToken(), { isSelected: false, canEditVisionRadius: true });
      expect(screen.queryByText('Aura')).not.toBeInTheDocument();

      renderCard(makeToken(), { isSelected: true, canEditVisionRadius: true });
      expect(screen.getByText('Aura')).toBeInTheDocument();
    });

    it('emits an aura preset update', async () => {
      const user = userEvent.setup();
      const onAuraChange = vi.fn();
      renderCard(makeToken(), { isSelected: true, canEditVisionRadius: true, onAuraChange });

      await user.click(screen.getByText('Protection'));

      expect(onAuraChange).toHaveBeenCalledWith(
        'tok-1',
        expect.objectContaining({
          auraVisible: true,
          auraRadius: 2,
          auraColor: '#4a9eff',
          auraType: 'presence',
        }),
      );
    });

    it('maps condition status to a semantic aura color', async () => {
      const user = userEvent.setup();
      const onAuraChange = vi.fn();
      renderCard(makeToken({ auraType: 'condition', auraCondition: 'stunned' }), {
        isSelected: true,
        canEditVisionRadius: true,
        onAuraChange,
      });

      await user.selectOptions(screen.getByDisplayValue('Stunned'), 'poisoned');

      expect(onAuraChange).toHaveBeenCalledWith(
        'tok-1',
        expect.objectContaining({ auraCondition: 'poisoned', auraColor: '#cc5de8' }),
      );
    });
  });

  describe('HP edit mode', () => {
    it('does not show HP input by default', () => {
      renderCard(makeToken(), { canEditHP: true, isSelected: true });
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('reveals input on HP value click when canEditHP is true and selected', async () => {
      const user = userEvent.setup();
      renderCard(makeToken({ hp: 30 }), { canEditHP: true, isSelected: true });

      await user.click(screen.getByText('30'));

      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('calls onHPChange with parsed value on Enter', async () => {
      const user = userEvent.setup();
      const onHPChange = vi.fn();
      renderCard(makeToken({ hp: 30 }), { canEditHP: true, isSelected: true, onHPChange });

      await user.click(screen.getByText('30'));
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '25');
      await user.keyboard('{Enter}');

      expect(onHPChange).toHaveBeenCalledWith('tok-1', 25);
    });

    it('calls onHPChange with 0 when HP is set to 0 (dead)', async () => {
      const user = userEvent.setup();
      const onHPChange = vi.fn();
      renderCard(makeToken({ hp: 30 }), { canEditHP: true, isSelected: true, onHPChange });

      await user.click(screen.getByText('30'));
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      await user.clear(input);
      await user.type(input, '0');
      await user.keyboard('{Enter}');

      expect(onHPChange).toHaveBeenCalledWith('tok-1', 0);
    });

    it('does not call onHPChange when input is left blank and blurred', async () => {
      const user = userEvent.setup();
      const onHPChange = vi.fn();
      renderCard(makeToken({ hp: 30 }), { canEditHP: true, isSelected: true, onHPChange });

      await user.click(screen.getByText('30'));
      const input = screen.getByRole('spinbutton');
      await user.clear(input);
      // Blur without entering a value — parseInt('') is NaN, should not call onHPChange
      await user.tab();

      expect(onHPChange).not.toHaveBeenCalled();
    });

    it('cancels edit on Escape without calling onHPChange', async () => {
      const user = userEvent.setup();
      const onHPChange = vi.fn();
      renderCard(makeToken({ hp: 30 }), { canEditHP: true, isSelected: true, onHPChange });

      await user.click(screen.getByText('30'));
      await user.keyboard('{Escape}');

      expect(onHPChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('does not allow HP edit when canEditHP is false', () => {
      renderCard(makeToken({ hp: 30 }), { canEditHP: false, isSelected: true });
      expect(screen.getByText('30')).toBeInTheDocument();
      const hpEl = screen.getByText('30');
      expect(hpEl.className).not.toMatch(/hpEditable/);
    });
  });
});
