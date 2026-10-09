import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { TemporaryLight } from '@vtt/shared';

import { TEMPORARY_LIGHT_DRAG_MIME } from '../hooks/useTemporaryLightDrop';
import { TemporaryLightsPanel } from './TemporaryLightsPanel';

const light = {
  id: 'l1',
  emitterType: 'torch',
  intensity: 0.8,
} as TemporaryLight;

describe('TemporaryLightsPanel', () => {
  it('sets the emitter type on drag start', () => {
    render(<TemporaryLightsPanel lights={[]} onIntensityChange={vi.fn()} onDelete={vi.fn()} />);
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByRole('button', { name: /Fireplace/ }), {
      dataTransfer: { setData, effectAllowed: '' },
    });
    expect(setData).toHaveBeenCalledWith(TEMPORARY_LIGHT_DRAG_MIME, 'fireplace');
  });

  it('commits intensity on release and deletes on click', () => {
    const onIntensityChange = vi.fn();
    const onDelete = vi.fn();
    render(
      <TemporaryLightsPanel lights={[light]} onIntensityChange={onIntensityChange} onDelete={onDelete} />,
    );

    const slider = screen.getByRole('slider', { name: 'Intensity for Torch 1' });
    fireEvent.change(slider, { target: { value: '0.4' } });
    expect(onIntensityChange).not.toHaveBeenCalled();
    fireEvent.pointerUp(slider);
    expect(onIntensityChange).toHaveBeenCalledWith('l1', 0.4);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Torch 1' }));
    expect(onDelete).toHaveBeenCalledWith('l1');
  });
});
