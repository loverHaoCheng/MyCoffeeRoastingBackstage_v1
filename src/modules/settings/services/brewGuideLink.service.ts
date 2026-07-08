import { isStandalonePwaRuntime } from '@/app/services/viewportMetrics.service';

export const brewGuideUrl = 'https://chu3.top/brewguide';

type ClipboardWriter = Pick<Clipboard, 'writeText'>;

const copyTextWithExecCommandFallback = (
  currentDocument: Document,
  text: string,
): void => {
  const textarea = currentDocument.createElement('textarea');

  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.setAttribute('aria-hidden', 'true');
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  textarea.style.left = '0';
  textarea.style.width = '1px';
  textarea.style.height = '1px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.zIndex = '-1';

  currentDocument.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const didCopy = currentDocument.execCommand('copy');

    if (!didCopy) {
      throw new Error('clipboard execCommand copy failed');
    }
  } finally {
    textarea.blur();
    currentDocument.body.removeChild(textarea);
  }
};

const copyTextToClipboard = async (
  currentDocument: Document,
  currentNavigator: Navigator,
  text: string,
): Promise<void> => {
  const clipboard = Reflect.get(
    currentNavigator,
    'clipboard',
  ) as ClipboardWriter | undefined;

  if (clipboard != null && typeof clipboard.writeText === 'function') {
    try {
      await clipboard.writeText(text);
      return;
    } catch {
      // iPhone PWA may reject the async clipboard API even during a tap.
    }
  }

  copyTextWithExecCommandFallback(currentDocument, text);
};

export const brewGuideLinkService = {
  async copyUrlToClipboard(
    currentDocument: Document,
    currentNavigator: Navigator,
  ): Promise<void> {
    await copyTextToClipboard(currentDocument, currentNavigator, brewGuideUrl);
  },
  shouldCopyInCurrentRuntime(currentWindow: Window): boolean {
    return isStandalonePwaRuntime(currentWindow);
  },
};
