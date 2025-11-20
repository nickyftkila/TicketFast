/**
 * Pruebas para el hook useMediaQuery
 */

import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

describe('useMediaQuery', () => {
  beforeEach(() => {
    // Resetear matchMedia mock
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  it('debe retornar false cuando la media query no coincide', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);
  });

  it('debe retornar true cuando la media query coincide', () => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: true,
        media: '(min-width: 1024px)',
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { result } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(true);
  });

  it('debe manejar cambios en la media query', () => {
    let changeHandler: ((e: MediaQueryListEvent) => void) | null = null;
    
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(() => ({
        matches: false,
        media: '(min-width: 1024px)',
        onchange: null,
        addListener: jest.fn((handler) => {
          changeHandler = handler;
        }),
        removeListener: jest.fn(),
        addEventListener: jest.fn((event, handler) => {
          if (event === 'change') {
            changeHandler = handler as (e: MediaQueryListEvent) => void;
          }
        }),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    const { result, rerender } = renderHook(() => useMediaQuery('(min-width: 1024px)'));
    expect(result.current).toBe(false);

    // Simular cambio
    if (changeHandler) {
      act(() => {
        changeHandler({ matches: true } as MediaQueryListEvent);
      });
      rerender();
    }

    // El estado se actualiza después del cambio
    expect(result.current).toBe(true);
  });
});

