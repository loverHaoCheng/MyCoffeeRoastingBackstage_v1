import { isStandalonePwaRuntime } from '@/app/services/viewportMetrics.service';

export type EnvironmentGuidanceType =
  | 'wechat-system-browser'
  | 'iphone-safari-pwa';

const EXCLUDED_IOS_BROWSER_TOKENS = [
  'CriOS',
  'FxiOS',
  'EdgiOS',
  'OPiOS',
  'MicroMessenger',
  'QQBrowser',
  'YaBrowser',
  'DuckDuckGo',
];

export const isWeChatBrowser = (userAgent: string): boolean => {
  return /MicroMessenger/i.test(userAgent);
};

export const isIphoneSafariBrowser = (userAgent: string): boolean => {
  const isIphone = /iPhone/i.test(userAgent);
  const includesSafari = /Safari/i.test(userAgent);
  const hasExcludedToken = EXCLUDED_IOS_BROWSER_TOKENS.some((token) =>
    userAgent.includes(token),
  );

  return isIphone && includesSafari && !hasExcludedToken;
};

export const resolveEnvironmentGuidance = (
  currentWindow: Window,
): EnvironmentGuidanceType | null => {
  const userAgent = currentWindow.navigator.userAgent;

  if (isWeChatBrowser(userAgent)) {
    return 'wechat-system-browser';
  }

  if (
    isIphoneSafariBrowser(userAgent) &&
    !isStandalonePwaRuntime(currentWindow)
  ) {
    return 'iphone-safari-pwa';
  }

  return null;
};
