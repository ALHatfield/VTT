import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { LightSource } from '@vtt/shared';
import { LIGHT_EMITTER_TYPES, LIGHT_PRESETS } from '@vtt/shared';

import { LIGHT_DRAG_MIME } from '../utils/light-placement';
import type { LightsSectionProps } from './LightsSection';
import { LightsSection } from './LightsSection';

function makeLight(overrides: Partial<LightSource> = {}): LightSource {
  return {
    id: 'l1',
    sceneId: 's',
    campaignId: 'c',
    x: 96,
    y: 160,
    radius: 8,
    color: '#ff9a3c',
    intensity: 0.8,
    falloff: 0.5,
    emitterType: 'torch',
    animationMode: 'flicker',
    animationSeed: 3,
    alwaysVisible: false,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function setup(overrides: Partial<LightsSectionProps> = {}): LightsSectionProps {
  const props: LightsSectionProps = {
    lights: [makeLight(), makeLight({ id: 'l2', emitterType: 'beacon', color: '#7fb2ff' })],
    selectedLightId: null,
    lightsVisible: true,
    error: null,
    weatherPreset: 'none',
    onToggleVisibility: vi.fn(),
    onAddPreset: vi.fn(),
    onSelectLight: vi.fn(),
    onDeleteLight: vi.fn(),
    onUpdateLight: vi.fn(),
    onWeatherPresetChange: vi.fn(),
    ...overrides,
  };
  render(<LightsSection {...props} />);
  return props;
}

describe('LightsSection', () => {
  it('renders a draggable palette entry for every preset', () => {
    setup();
    const palette = screen.getByRole('list', { name: 'Light presets' });
    for (const type of LIGHT_EMITTER_TYPES) {
      expect(palette).toHaveTextContent(LIGHT_PRESETS[type].label);
    }
  });

  it('puts the emitter type on the drag payload', () => {
    setup();
    const setData = vi.fn();
    fireEvent.dragStart(screen.getByRole('button', { name: 'Lantern' }), {
      dataTransfer: { setData, effectAllowed: '' },
    });
    expect(setData).toHaveBeenCalledWith(LIGHT_DRAG_MIME, 'lantern');
  });

  it('adds a preset by click as a keyboard-accessible alternative to dragging', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Fireplace' }));
    expect(props.onAddPreset).toHaveBeenCalledWith('fireplace');
  });

  it('lists lights by preset label and selects on click', () => {
    const props = setup();
    fireEvent.click(screen.getByText('Aura Beacon 2'));
    expect(props.onSelectLight).toHaveBeenCalledWith('l2');
  });

  it('shows an empty state', () => {
    setup({ lights: [] });
    expect(screen.getByText('No lights on this scene.')).toBeInTheDocument();
  });

  it('deletes from the list', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete Torch 1' }));
    expect(props.onDeleteLight).toHaveBeenCalledWith('l1');
  });

  it('toggles visibility', () => {
    const props = setup({ lightsVisible: false });
    const btn = screen.getByRole('button', { name: 'Show lights' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(props.onToggleVisibility).toHaveBeenCalled();
  });

  it('changes the scene default weather', () => {
    const props = setup();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'snow' } });
    expect(props.onWeatherPresetChange).toHaveBeenCalledWith('snow');
  });

  it('disables the weather select while loading', () => {
    setup({ weatherPreset: null });
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('shows errors', () => {
    setup({ error: 'Nope' });
    expect(screen.getByRole('alert')).toHaveTextContent('Nope');
  });
});

describe('LightInspector (via LightsSection)', () => {
  it('prompts for a selection when none is active', () => {
    setup();
    expect(screen.getByText('Select a light to edit its properties.')).toBeInTheDocument();
  });

  it('edits intensity, radius, falloff, and color of the selected light', () => {
    const props = setup({ selectedLightId: 'l1' });

    fireEvent.change(screen.getByLabelText('Intensity'), { target: { value: '0.25' } });
    fireEvent.change(screen.getByLabelText('Radius'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Falloff'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Color'), { target: { value: '#00ff00' } });

    expect(props.onUpdateLight).toHaveBeenCalledWith('l1', { intensity: 0.25 });
    expect(props.onUpdateLight).toHaveBeenCalledWith('l1', { radius: 12 });
    expect(props.onUpdateLight).toHaveBeenCalledWith('l1', { falloff: 1 });
    expect(props.onUpdateLight).toHaveBeenCalledWith('l1', { color: '#00ff00' });
  });

  it('toggles animation mode', () => {
    const props = setup({ selectedLightId: 'l1' });
    expect(screen.getByRole('group', { name: 'Animation mode' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flicker' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Pulse' }));
    expect(props.onUpdateLight).toHaveBeenCalledWith('l1', { animationMode: 'pulse' });
  });

  it('toggles always-on visibility', () => {
    const props = setup({ selectedLightId: 'l1' });
    const toggle = screen.getByLabelText('Always on');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(props.onUpdateLight).toHaveBeenCalledWith('l1', { alwaysVisible: true });
  });

  it('commits a typed position on Enter and reverts invalid input', () => {
    const props = setup({ selectedLightId: 'l1' });
    const x = screen.getByLabelText('Position X');

    fireEvent.change(x, { target: { value: '256' } });
    fireEvent.keyDown(x, { key: 'Enter' });
    expect(props.onUpdateLight).toHaveBeenCalledWith('l1', { x: 256 });

    const y = screen.getByLabelText('Position Y');
    fireEvent.change(y, { target: { value: '' } });
    fireEvent.blur(y);
    expect(y).toHaveValue(160);
    expect(props.onUpdateLight).toHaveBeenCalledTimes(1);
  });

  it('deletes the selected light', () => {
    const props = setup({ selectedLightId: 'l1' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete light' }));
    expect(props.onDeleteLight).toHaveBeenCalledWith('l1');
  });
});
