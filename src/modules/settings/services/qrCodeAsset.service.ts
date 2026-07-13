export type QrCodeKey = 'author' | 'community' | 'sponsor';

type BundledQrCodeKey = Exclude<QrCodeKey, 'community'>;

export type QrCodeAssetLoader = () => Promise<{ default: string }>;

export type QrCodeAssetLoaders = Record<BundledQrCodeKey, QrCodeAssetLoader>;

const COMMUNITY_QR_CODE_PATH = '/community-qr.png';

const qrCodeLoaders: QrCodeAssetLoaders = {
  author: () => import('@/assets/settings-codes/author-code.webp'),
  sponsor: () => import('@/assets/settings-codes/sponsor-code.webp'),
};

const qrCodeFallbackLoaders: QrCodeAssetLoaders = {
  author: () => import('@/assets/settings-codes/author-code.png'),
  sponsor: () => import('@/assets/settings-codes/sponsor-code.png'),
};

export const createQrCodeAssetLoader = (loaders: QrCodeAssetLoaders) => {
  const pendingLoads = new Map<BundledQrCodeKey, Promise<{ default: string }>>();

  return (code: BundledQrCodeKey): Promise<{ default: string }> => {
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
  code === 'community'
    ? Promise.resolve({ default: `${COMMUNITY_QR_CODE_PATH}?updated=${String(Date.now())}` })
    : loadQrCodeAssetOnce(code);

export const loadQrCodeFallbackAsset = (code: QrCodeKey): Promise<{ default: string }> =>
  code === 'community'
    ? Promise.reject(new Error('Community QR code has no bundled fallback.'))
    : loadQrCodeFallbackAssetOnce(code);
