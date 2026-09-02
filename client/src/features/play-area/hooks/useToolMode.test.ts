import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useToolMode } from './useToolMode';

describe('useToolMode', () => {
  it('defaults to select tool', () => {
    const { result } = renderHook(() => useToolMode());
    expect(result.current.activeTool).toBe('select');
  });

  it('respects initial tool override', () => {
    const { result } = renderHook(() => useToolMode('pan'));
    expect(result.current.activeTool).toBe('pan');
  });

  it('switches from select to pan', () => {
    const { result } = renderHook(() => useToolMode());
    act(() => result.current.setActiveTool('pan'));
    expect(result.current.activeTool).toBe('pan');
  });

  it('switches back from pan to select', () => {
    const { result } = renderHook(() => useToolMode('pan'));
    act(() => result.current.setActiveTool('select'));
    expect(result.current.activeTool).toBe('select');
  });
});
