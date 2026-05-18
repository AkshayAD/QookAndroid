import { useEffect } from 'react';
import type { RefObject } from 'react';
import { listenForNativeSafeAreaInsets, setDocumentCssPxVar, setMeasuredChromeHeight } from '../lib/appChrome';

export function useNativeSafeAreaInsets(): void {
  useEffect(() => {
    return listenForNativeSafeAreaInsets();
  }, []);
}

export function useMeasuredChromeVar<T extends HTMLElement>(
  ref: RefObject<T | null>,
  variableName: string,
): void {
  useEffect(() => {
    const element = ref.current;

    if (!element) {
      setDocumentCssPxVar(variableName, 0);
      return;
    }

    const syncHeight = () => {
      setMeasuredChromeHeight(variableName, element);
    };

    syncHeight();

    const observer = new ResizeObserver(() => {
      syncHeight();
    });

    observer.observe(element);
    window.addEventListener('resize', syncHeight);
    window.addEventListener('orientationchange', syncHeight);
    window.addEventListener('qook-native-insets', syncHeight as EventListener);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
      window.removeEventListener('orientationchange', syncHeight);
      window.removeEventListener('qook-native-insets', syncHeight as EventListener);
      setDocumentCssPxVar(variableName, 0);
    };
  }, [ref, variableName]);
}
