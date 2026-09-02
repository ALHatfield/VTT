import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useFogViewMode } from './useFogViewMode';

describe('useFogViewMode', () => {
  it('defaults to dm view', () => {
    const { result } = renderHook(() => useFogViewMode());
    expect(result.current.fogViewMode).toBe('dm');
  });

  it('switches to player view', () => {
    const { result } = renderHook(() => useFogViewMode());
    act(() => result.current.setFogViewMode('player'));
    expect(result.current.fogViewMode).toBe('player');
  });

  it('switches back to dm view', () => {
    const { result } = renderHook(() => useFogViewMode());
    act(() => result.current.setFogViewMode('player'));
    act(() => result.current.setFogViewMode('dm'));
    expect(result.current.fogViewMode).toBe('dm');
  });
});
