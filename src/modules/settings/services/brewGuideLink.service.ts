import { isStandalonePwaRuntime } from '@/app/services/viewportMetrics.service';

export const brewGuideUrl = 'https://chu3.top/brewguide';

type ClipboardWriter = Pick<Clipboard, 'writeText'>;

const copyTextToClipboard = async (
  currentNavigator: Navigator,
  text: string,
): Promise<void> => {
  const clipboard = Reflect.get(
    currentNavigator,
    'clipboard',
  ) as ClipboardWriter | undefined;

  if (clipboard == null || typeof clipboard.writeText !== 'function') {
    throw new Error('clipboard api unavailable');
  }

  await clipboard.writeText(text);
};

export const brewGuideLinkService = {
  async copyUrlToClipboard(currentNavigator: Navigator): Promise<void> {
    await copyTextToClipboard(currentNavigator, brewGuideUrl);
  },
  shouldCopyInCurrentRuntime(currentWindow: Window): boolean {
    return isStandalonePwaRuntime(currentWindow);
  },
};
