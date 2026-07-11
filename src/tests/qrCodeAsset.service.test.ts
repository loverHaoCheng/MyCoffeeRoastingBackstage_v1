import { describe, expect, it, vi } from 'vitest';

import {
  createQrCodeAssetLoader,
  type QrCodeAssetLoaders,
} from '@/modules/settings/services/qrCodeAsset.service';

const createLoaders = (authorLoader: QrCodeAssetLoaders['author']): QrCodeAssetLoaders => ({
  author: authorLoader,
  sponsor: vi.fn().mockResolvedValue({ default: 'sponsor-code.webp' }),
});

describe('createQrCodeAssetLoader', () => {
  it('combines concurrent requests for the same asset into one import', async () => {
    let resolveAuthorLoad: ((value: { default: string }) => void) | undefined;
    const authorLoader = vi.fn(
      () =>
        new Promise<{ default: string }>((resolve) => {
          resolveAuthorLoad = resolve;
        }),
    );
    const loadQrCodeAsset = createQrCodeAssetLoader(createLoaders(authorLoader));

    const firstLoad = loadQrCodeAsset('author');
    const secondLoad = loadQrCodeAsset('author');

    expect(secondLoad).toBe(firstLoad);
    expect(authorLoader).toHaveBeenCalledTimes(1);

    resolveAuthorLoad?.({ default: 'author-code.webp' });

    await expect(firstLoad).resolves.toEqual({ default: 'author-code.webp' });
  });

  it('allows a new import attempt after a failed request', async () => {
    const authorLoader = vi
      .fn<QrCodeAssetLoaders['author']>()
      .mockRejectedValueOnce(new Error('asset unavailable'))
      .mockResolvedValueOnce({ default: 'author-code.webp' });
    const loadQrCodeAsset = createQrCodeAssetLoader(createLoaders(authorLoader));

    await expect(loadQrCodeAsset('author')).rejects.toThrow('asset unavailable');
    await expect(loadQrCodeAsset('author')).resolves.toEqual({ default: 'author-code.webp' });

    expect(authorLoader).toHaveBeenCalledTimes(2);
  });
});
