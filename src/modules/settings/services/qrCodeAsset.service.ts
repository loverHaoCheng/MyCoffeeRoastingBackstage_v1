export type QrCodeKey = 'author' | 'sponsor';

export type QrCodeAssetLoader = () => Promise<{ default: string }>;

export type QrCodeAssetLoaders = Record<QrCodeKey, QrCodeAssetLoader>;

const qrCodeLoaders: QrCodeAssetLoaders = {
  author: () => import('@/assets/settings-codes/author-code.webp'),
  sponsor: () => import('@/assets/settings-codes/sponsor-code.webp'),
};

const qrCodeFallbackLoaders: QrCodeAssetLoaders = {
  author: () => import('@/assets/settings-codes/author-code.png'),
  sponsor: () => import('@/assets/settings-codes/sponsor-code.png'),
};

export const createQrCodeAssetLoader = (loaders: QrCodeAssetLoaders) => {
  const pendingLoads = new Map<QrCodeKey, Promise<{ default: string }>>();

  return (code: QrCodeKey): Promise<{ default: string }> => {
    const pendingLoad = pendingLoads.get(code);

    if (pendingLoad) {
      return pendingLoad;
    }

    const load = loaders[code]().finally(() => {
      pendingLoads.delete(code);
    });

    pendingLoads.set(code, load);

    return load;
  };
};

const loadQrCodeAssetOnce = createQrCodeAssetLoader(qrCodeLoaders);
const loadQrCodeFallbackAssetOnce = createQrCodeAssetLoader(qrCodeFallbackLoaders);

export const loadQrCodeAsset = (code: QrCodeKey): Promise<{ default: string }> =>
  loadQrCodeAssetOnce(code);

export const loadQrCodeFallbackAsset = (code: QrCodeKey): Promise<{ default: string }> =>
  loadQrCodeFallbackAssetOnce(code);
