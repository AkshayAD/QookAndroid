export const APP_CHROME_VARS = {
  safeTop: '--app-safe-top',
  safeBottom: '--app-safe-bottom',
  safeLeft: '--app-safe-left',
  safeRight: '--app-safe-right',
  topChromeHeight: '--app-top-chrome-height',
  bottomChromeHeight: '--app-bottom-chrome-height',
} as const;

export interface NativeInsetDetail {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

const toPx = (value: number): string => `${Math.max(0, Math.ceil(value))}px`;

const toSafeInset = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, value);
};

export const setDocumentCssPxVar = (
  variableName: string,
  value: number,
  root: HTMLElement = document.documentElement,
): void => {
  root.style.setProperty(variableName, toPx(value));
};

export const setAppSafeAreaInsets = (
  detail: NativeInsetDetail,
  root: HTMLElement = document.documentElement,
): void => {
  setDocumentCssPxVar(APP_CHROME_VARS.safeTop, toSafeInset(detail.top), root);
  setDocumentCssPxVar(APP_CHROME_VARS.safeBottom, toSafeInset(detail.bottom), root);
  setDocumentCssPxVar(APP_CHROME_VARS.safeLeft, toSafeInset(detail.left), root);
  setDocumentCssPxVar(APP_CHROME_VARS.safeRight, toSafeInset(detail.right), root);
};

export const measureElementHeight = (element: Element): number => {
  const rect = element.getBoundingClientRect();
  return Math.max(0, Math.ceil(rect.height));
};

export const setMeasuredChromeHeight = (
  variableName: string,
  element: Element,
  root: HTMLElement = document.documentElement,
): void => {
  setDocumentCssPxVar(variableName, measureElementHeight(element), root);
};

export const listenForNativeSafeAreaInsets = (
  onInsetsApplied?: (detail: NativeInsetDetail) => void,
  root: HTMLElement = document.documentElement,
): (() => void) => {
  const handleInsets = (event: Event) => {
    const customEvent = event as CustomEvent<NativeInsetDetail | undefined>;
    const detail = customEvent.detail ?? {};
    setAppSafeAreaInsets(detail, root);
    onInsetsApplied?.(detail);
  };

  window.addEventListener('qook-native-insets', handleInsets as EventListener);

  return () => {
    window.removeEventListener('qook-native-insets', handleInsets as EventListener);
  };
};
