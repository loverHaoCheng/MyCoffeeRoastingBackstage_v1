interface NavigatorWithStandalone extends Navigator {
  readonly standalone?: boolean;
}

export const isStandalonePwaRuntime = (currentWindow: Window): boolean => {
  const displayModeStandalone = currentWindow.matchMedia(
    '(display-mode: standalone)',
  ).matches;
  const iosStandalone =
    (currentWindow.navigator as NavigatorWithStandalone).standalone === true;

  return displayModeStandalone || iosStandalone;
};

export const syncViewportMetrics = (
  currentWindow: Window,
  currentDocument: Document,
): void => {
  currentDocument.documentElement.dataset.standalonePwa = isStandalonePwaRuntime(
    currentWindow,
  )
    ? 'true'
    : 'false';
};
