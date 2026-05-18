import React, { useCallback, useRef } from 'react';
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_CHROME_VARS } from '../lib/appChrome';
import { useMeasuredChromeVar, useNativeSafeAreaInsets } from './useAppChrome';

type ResizeObserverRegistration = {
  callback: ResizeObserverCallback;
  element: Element | null;
};

const resizeObservers: ResizeObserverRegistration[] = [];

class ResizeObserverMock {
  private readonly registration: ResizeObserverRegistration;

  constructor(callback: ResizeObserverCallback) {
    this.registration = { callback, element: null };
    resizeObservers.push(this.registration);
  }

  observe(element: Element) {
    this.registration.element = element;
  }

  disconnect() {
    this.registration.element = null;
  }
}

function createDomRect(height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    width: 0,
    height,
    top: 0,
    right: 0,
    bottom: height,
    left: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function MeasuredProbe({
  variableName,
  heightRef,
}: {
  variableName: string;
  heightRef: React.MutableRefObject<number>;
}) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  useMeasuredChromeVar(elementRef, variableName);

  const handleRef = useCallback((node: HTMLDivElement | null) => {
    elementRef.current = node;

    if (!node) {
      return;
    }

    Object.defineProperty(node, 'getBoundingClientRect', {
      configurable: true,
      value: () => createDomRect(heightRef.current),
    });
  }, [heightRef]);

  return <div ref={handleRef}>probe</div>;
}

function NativeInsetProbe() {
  useNativeSafeAreaInsets();
  return <div>native-insets</div>;
}

describe('useAppChrome', () => {
  beforeEach(() => {
    resizeObservers.length = 0;
    document.documentElement.removeAttribute('style');
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('updates the top chrome CSS variable when the measured header changes', async () => {
    const heightRef = { current: 48 };
    render(<MeasuredProbe variableName={APP_CHROME_VARS.topChromeHeight} heightRef={heightRef} />);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(APP_CHROME_VARS.topChromeHeight)).toBe('48px');
    });

    heightRef.current = 72;
    resizeObservers[0]?.callback([], {} as ResizeObserver);

    expect(document.documentElement.style.getPropertyValue(APP_CHROME_VARS.topChromeHeight)).toBe('72px');
  });

  it('updates the bottom chrome CSS variable when the measured nav changes', async () => {
    const heightRef = { current: 56 };
    render(<MeasuredProbe variableName={APP_CHROME_VARS.bottomChromeHeight} heightRef={heightRef} />);

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(APP_CHROME_VARS.bottomChromeHeight)).toBe('56px');
    });

    heightRef.current = 84;
    resizeObservers[0]?.callback([], {} as ResizeObserver);

    expect(document.documentElement.style.getPropertyValue(APP_CHROME_VARS.bottomChromeHeight)).toBe('84px');
  });

  it('applies native inset events to the safe-area CSS variables', async () => {
    render(<NativeInsetProbe />);

    window.dispatchEvent(new CustomEvent('qook-native-insets', {
      detail: { top: 18, bottom: 30, left: 4, right: 6 },
    }));

    await waitFor(() => {
      expect(document.documentElement.style.getPropertyValue(APP_CHROME_VARS.safeTop)).toBe('18px');
      expect(document.documentElement.style.getPropertyValue(APP_CHROME_VARS.safeBottom)).toBe('30px');
      expect(document.documentElement.style.getPropertyValue(APP_CHROME_VARS.safeLeft)).toBe('4px');
      expect(document.documentElement.style.getPropertyValue(APP_CHROME_VARS.safeRight)).toBe('6px');
    });
  });
});
