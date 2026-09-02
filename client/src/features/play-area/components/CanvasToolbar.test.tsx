import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NPC_DRAG_MIME } from '../hooks/useNpcDrop';
import { CanvasToolbar } from './CanvasToolbar';
import styles from './CanvasToolbar.module.css';

describe('CanvasToolbar', () => {
  it('renders Select, Pan, and Measure tools for DM', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/Select tool/)).toBeInTheDocument();
    expect(screen.getByTitle(/Pan tool/)).toBeInTheDocument();
    expect(screen.getByTitle(/Measure tool/)).toBeInTheDocument();
  });

  it('renders Select, Pan, and Measure tools for Player', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="player" />);
    expect(screen.getByTitle(/Select tool/)).toBeInTheDocument();
    expect(screen.getByTitle(/Pan tool/)).toBeInTheDocument();
    expect(screen.getByTitle(/Measure tool/)).toBeInTheDocument();
  });

  it('renders only Pan tool for Observer', () => {
    render(<CanvasToolbar activeTool="pan" onToolChange={() => undefined} role="observer" />);
    expect(screen.queryByTitle(/Select tool/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Measure tool/)).not.toBeInTheDocument();
    expect(screen.getByTitle(/Pan tool/)).toBeInTheDocument();
  });

  it('marks active tool as pressed', () => {
    render(<CanvasToolbar activeTool="pan" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/Pan tool/).closest('button')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTitle(/Select tool/).closest('button')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('calls onToolChange when a tool button is clicked', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="select" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle(/Pan tool/));
    expect(onToolChange).toHaveBeenCalledWith('pan');
  });

  it('shows Private toggle when measure tool is active and onMeasurePrivateChange is provided', () => {
    const onMeasurePrivateChange = vi.fn();
    render(
      <CanvasToolbar
        activeTool="measure"
        onToolChange={() => undefined}
        role="dm"
        measurePrivate={false}
        onMeasurePrivateChange={onMeasurePrivateChange}
      />,
    );
    expect(screen.getByLabelText(/Private/i)).toBeInTheDocument();
  });

  it('calls onMeasurePrivateChange when Private checkbox is toggled', () => {
    const onMeasurePrivateChange = vi.fn();
    render(
      <CanvasToolbar
        activeTool="measure"
        onToolChange={() => undefined}
        role="player"
        measurePrivate={false}
        onMeasurePrivateChange={onMeasurePrivateChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Private/i));
    expect(onMeasurePrivateChange).toHaveBeenCalledWith(true);
  });

  it('does not show Private toggle when measure tool is not active', () => {
    render(
      <CanvasToolbar
        activeTool="select"
        onToolChange={() => undefined}
        role="dm"
        measurePrivate={false}
        onMeasurePrivateChange={() => undefined}
      />,
    );
    expect(screen.queryByLabelText(/Private/i)).not.toBeInTheDocument();
  });
});

describe('CanvasToolbar — Fog tool (DM only)', () => {
  it('renders Fog button for DM', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/Fog of War/)).toBeInTheDocument();
  });

  it('does not render Fog button for Player', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="player" />);
    expect(screen.queryByTitle(/Fog of War/)).not.toBeInTheDocument();
  });

  it('does not render Fog button for Observer', () => {
    render(<CanvasToolbar activeTool="pan" onToolChange={() => undefined} role="observer" />);
    expect(screen.queryByTitle(/Fog of War/)).not.toBeInTheDocument();
  });

  it('Fog button shows as pressed when fog-reveal is active', () => {
    render(<CanvasToolbar activeTool="fog-reveal" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/Fog of War/).closest('button')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('Fog button shows as pressed when fog-hide is active', () => {
    render(<CanvasToolbar activeTool="fog-hide" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/Fog of War/).closest('button')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('clicking Fog button when inactive calls onToolChange with fog-reveal', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="select" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle(/Fog of War/));
    expect(onToolChange).toHaveBeenCalledWith('fog-reveal');
  });

  it('clicking Fog button when fog is active calls onToolChange with select', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="fog-reveal" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle(/Fog of War/));
    expect(onToolChange).toHaveBeenCalledWith('select');
  });

  it('shows Reveal/Hide sub-mode buttons when fog-reveal is active', () => {
    render(<CanvasToolbar activeTool="fog-reveal" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle('Reveal fog area')).toBeInTheDocument();
    expect(screen.getByTitle('Hide fog area')).toBeInTheDocument();
  });

  it('clicking Reveal sub-mode calls onToolChange with fog-reveal', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="fog-hide" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle('Reveal fog area'));
    expect(onToolChange).toHaveBeenCalledWith('fog-reveal');
  });

  it('clicking Hide sub-mode calls onToolChange with fog-hide', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="fog-reveal" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle('Hide fog area'));
    expect(onToolChange).toHaveBeenCalledWith('fog-hide');
  });

  it('shows Player view toggle when fog tool is active and onFogViewModeChange is provided', () => {
    const onFogViewModeChange = vi.fn();
    render(
      <CanvasToolbar
        activeTool="fog-reveal"
        onToolChange={() => undefined}
        role="dm"
        fogViewMode="dm"
        onFogViewModeChange={onFogViewModeChange}
      />,
    );
    expect(screen.getByLabelText(/Player view/i)).toBeInTheDocument();
  });

  it('toggling Player view checkbox calls onFogViewModeChange with player', () => {
    const onFogViewModeChange = vi.fn();
    render(
      <CanvasToolbar
        activeTool="fog-reveal"
        onToolChange={() => undefined}
        role="dm"
        fogViewMode="dm"
        onFogViewModeChange={onFogViewModeChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Player view/i));
    expect(onFogViewModeChange).toHaveBeenCalledWith('player');
  });

  it('toggling Player view off calls onFogViewModeChange with dm', () => {
    const onFogViewModeChange = vi.fn();
    render(
      <CanvasToolbar
        activeTool="fog-reveal"
        onToolChange={() => undefined}
        role="dm"
        fogViewMode="player"
        onFogViewModeChange={onFogViewModeChange}
      />,
    );
    fireEvent.click(screen.getByLabelText(/Player view/i));
    expect(onFogViewModeChange).toHaveBeenCalledWith('dm');
  });

  it('clicking Fog button when fog-hide is active calls onToolChange with select', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="fog-hide" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle(/Fog of War/));
    expect(onToolChange).toHaveBeenCalledWith('select');
  });

  it('does not show Player view toggle when fog is active but onFogViewModeChange is not provided', () => {
    render(<CanvasToolbar activeTool="fog-reveal" onToolChange={() => undefined} role="dm" />);
    expect(screen.queryByLabelText(/Player view/i)).not.toBeInTheDocument();
  });

  it('does not show fog panel when fog tool is not active', () => {
    render(
      <CanvasToolbar
        activeTool="select"
        onToolChange={() => undefined}
        role="dm"
        onFogViewModeChange={() => undefined}
      />,
    );
    expect(screen.queryByTitle('Reveal fog area')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Player view/i)).not.toBeInTheDocument();
  });
});

describe('CanvasToolbar — NPC tool (DM only)', () => {
  it('renders NPC button for DM', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/NPC tokens/)).toBeInTheDocument();
  });

  it('does not render NPC button for Player', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="player" />);
    expect(screen.queryByTitle(/NPC tokens/)).not.toBeInTheDocument();
  });

  it('does not render NPC button for Observer', () => {
    render(<CanvasToolbar activeTool="pan" onToolChange={() => undefined} role="observer" />);
    expect(screen.queryByTitle(/NPC tokens/)).not.toBeInTheDocument();
  });

  it('clicking NPC button when inactive calls onToolChange with npc-place', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="select" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle(/NPC tokens/));
    expect(onToolChange).toHaveBeenCalledWith('npc-place');
  });

  it('clicking NPC button when active calls onToolChange with select', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="npc-place" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle(/NPC tokens/));
    expect(onToolChange).toHaveBeenCalledWith('select');
  });

  it('NPC button shows as pressed when npc-place is active', () => {
    render(<CanvasToolbar activeTool="npc-place" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/NPC tokens/).closest('button')).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('shows Ally and Enemy drag sources when npc-place is active', () => {
    render(<CanvasToolbar activeTool="npc-place" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/Drag to place ally NPC token/)).toBeInTheDocument();
    expect(screen.getByTitle(/Drag to place enemy NPC token/)).toBeInTheDocument();
  });

  it('does not show NPC panel when npc-place is not active', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="dm" />);
    expect(screen.queryByTitle(/Drag to place ally NPC token/)).not.toBeInTheDocument();
    expect(screen.queryByTitle(/Drag to place enemy NPC token/)).not.toBeInTheDocument();
  });

  it('ally drag start sets correct NPC subtype in dataTransfer', () => {
    render(<CanvasToolbar activeTool="npc-place" onToolChange={() => undefined} role="dm" />);
    const allyItem = screen.getByTitle(/Drag to place ally NPC token/);
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(allyItem, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith(NPC_DRAG_MIME, 'ally');
  });

  it('enemy drag start sets correct NPC subtype in dataTransfer', () => {
    render(<CanvasToolbar activeTool="npc-place" onToolChange={() => undefined} role="dm" />);
    const enemyItem = screen.getByTitle(/Drag to place enemy NPC token/);
    const dataTransfer = { setData: vi.fn(), effectAllowed: '' };
    fireEvent.dragStart(enemyItem, { dataTransfer });
    expect(dataTransfer.setData).toHaveBeenCalledWith(NPC_DRAG_MIME, 'enemy');
  });
});

describe('CanvasToolbar — Draw tool (Phase 4K)', () => {
  it('renders Draw button for DM', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle(/Draw tool/)).toBeInTheDocument();
  });

  it('renders Draw button for Player', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="player" />);
    expect(screen.getByTitle(/Draw tool/)).toBeInTheDocument();
  });

  it('does not render Draw button for Observer', () => {
    render(<CanvasToolbar activeTool="pan" onToolChange={() => undefined} role="observer" />);
    expect(screen.queryByTitle(/Draw tool/)).not.toBeInTheDocument();
  });

  it('clicking Draw button when inactive calls onToolChange with draw-freehand by default', () => {
    const onToolChange = vi.fn();
    render(
      <CanvasToolbar
        activeTool="select"
        onToolChange={onToolChange}
        role="dm"
        drawShapeKind="freehand"
      />,
    );
    fireEvent.click(screen.getByTitle(/Draw tool/));
    expect(onToolChange).toHaveBeenCalledWith('draw-freehand');
  });

  it('clicking Draw button when draw-freehand is active calls onToolChange with select', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar activeTool="draw-freehand" onToolChange={onToolChange} role="dm" />);
    fireEvent.click(screen.getByTitle(/Draw tool/));
    expect(onToolChange).toHaveBeenCalledWith('select');
  });

  it('shows draw panel sub-modes when draw-freehand is active', () => {
    render(<CanvasToolbar activeTool="draw-freehand" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle('Freehand')).toBeInTheDocument();
    expect(screen.getByTitle('Rectangle')).toBeInTheDocument();
    expect(screen.getByTitle('Circle')).toBeInTheDocument();
  });

  it('keeps the toolbar at its normal width when draw is active', () => {
    render(<CanvasToolbar activeTool="draw-freehand" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByRole('toolbar', { name: 'Canvas tools' }).className).toBe(styles.toolbar);
  });

  it('shows draw panel sub-modes when draw-shape is active', () => {
    render(<CanvasToolbar activeTool="draw-shape" onToolChange={() => undefined} role="dm" />);
    expect(screen.getByTitle('Freehand')).toBeInTheDocument();
    expect(screen.getByTitle('Rectangle')).toBeInTheDocument();
    expect(screen.getByTitle('Circle')).toBeInTheDocument();
  });

  it('clicking Rect sub-mode calls onDrawShapeKindChange with rect and onToolChange with draw-shape', () => {
    const onToolChange = vi.fn();
    const onDrawShapeKindChange = vi.fn();
    render(
      <CanvasToolbar
        activeTool="draw-freehand"
        onToolChange={onToolChange}
        role="dm"
        onDrawShapeKindChange={onDrawShapeKindChange}
      />,
    );
    fireEvent.click(screen.getByTitle('Rectangle'));
    expect(onDrawShapeKindChange).toHaveBeenCalledWith('rect');
    expect(onToolChange).toHaveBeenCalledWith('draw-shape');
  });

  it('shows Clear All button for DM and Clear Mine for Player', () => {
    const { rerender } = render(
      <CanvasToolbar activeTool="draw-freehand" onToolChange={() => undefined} role="dm" />,
    );
    expect(screen.getByTitle(/Clear all drawings/)).toBeInTheDocument();

    rerender(
      <CanvasToolbar activeTool="draw-freehand" onToolChange={() => undefined} role="player" />,
    );
    expect(screen.getByTitle(/Clear your drawings/)).toBeInTheDocument();
  });

  it('calls onDrawClear when clear button is clicked', () => {
    const onDrawClear = vi.fn();
    render(
      <CanvasToolbar
        activeTool="draw-freehand"
        onToolChange={() => undefined}
        role="dm"
        onDrawClear={onDrawClear}
      />,
    );
    fireEvent.click(screen.getByTitle(/Clear all drawings/));
    expect(onDrawClear).toHaveBeenCalled();
  });

  it('does not show draw panel when draw tool is not active', () => {
    render(<CanvasToolbar activeTool="select" onToolChange={() => undefined} role="dm" />);
    expect(screen.queryByTitle('Freehand')).not.toBeInTheDocument();
  });
});
