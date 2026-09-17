import type { QrCodeKey } from '@/modules/settings/services/qrCodeAsset.service';

export const qrCodeEntries: Record<
  QrCodeKey,
  {
    alt: string;
    buttonLabel: string;
  }
> = {
  author: {
    alt: '作者交流二维码',
    buttonLabel: '和作者交流一下',
  },
  community: {
    alt: '进群交流 bugs 二维码',
    buttonLabel: '进群交流 bugs',
  },
  sponsor: {
    alt: '赞助支持二维码',
    buttonLabel: '请作者喝杯咖啡',
  },
};
