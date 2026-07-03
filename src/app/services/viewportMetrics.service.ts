interface NavigatorWithStandalone extends Navigator {
  readonly standalone?: boolean;
}

const roundViewportLength = (value: number): string => {
  return String(Math.round(value)) + 'px';
};

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
  const visualViewportHeight =
    currentWindow.visualViewport?.height ?? currentWindow.innerHeight;
  const resolvedViewportHeight = Math.min(
    currentWindow.innerHeight,
    visualViewportHeight,
  );
  const rootStyle = currentDocument.documentElement.style;

  rootStyle.setProperty(
    '--app-viewport-height',
    roundViewportLength(resolvedViewportHeight),
  );
  rootStyle.setProperty(
    '--app-visual-viewport-height',
    roundViewportLength(visualViewportHeight),
  );
  currentDocument.documentElement.dataset.standalonePwa = isStandalonePwaRuntime(
    currentWindow,
  )
    ? 'true'
    : 'false';
};
