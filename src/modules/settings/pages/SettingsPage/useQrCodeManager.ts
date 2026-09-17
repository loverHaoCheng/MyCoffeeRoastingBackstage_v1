import { useCallback, useState } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';

import {
  loadQrCodeAsset,
  loadQrCodeFallbackAsset,
  type QrCodeKey,
} from '@/modules/settings/services/qrCodeAsset.service';

export const useQrCodeManager = () => {
  const [visibleCode, setVisibleCode] = useState<null | QrCodeKey>(null);
  const [qrCodeFallbackTried, setQrCodeFallbackTried] = useState<Partial<Record<QrCodeKey, boolean>>>({});
  const [qrCodeLoadErrors, setQrCodeLoadErrors] = useState<Partial<Record<QrCodeKey, string>>>({});
  const [qrCodeSources, setQrCodeSources] = useState<Partial<Record<QrCodeKey, string>>>({});

  const loadQrCode = useCallback((code: QrCodeKey) => {
    if (code !== 'community' && qrCodeSources[code]) {
      return;
    }

    setQrCodeLoadErrors((current) => ({
      ...current,
      [code]: undefined,
    }));
    setQrCodeFallbackTried((current) => ({
      ...current,
      [code]: false,
    }));

    void loadQrCodeAsset(code)
      .then((module) => {
        setQrCodeSources((current) => ({
          ...current,
          [code]: module.default,
        }));
      })
      .catch(() => {
        setQrCodeLoadErrors((current) => ({
          ...current,
          [code]: '二维码加载失败，请重试。',
        }));
      });
  }, [qrCodeSources]);

  const handleQrCodeImageError = useCallback((code: QrCodeKey) => {
    if (code === 'community') {
      setQrCodeLoadErrors((current) => ({
        ...current,
        [code]: '群二维码暂时不可用，请稍后重试。',
      }));
      return;
    }

    setQrCodeFallbackTried((current) => {
      const fallbackTried = current[code];

      if (fallbackTried) {
        setQrCodeLoadErrors((prev) => ({
          ...prev,
          [code]: '二维码加载失败，请重试。',
        }));
        return current;
      }

      void loadQrCodeFallbackAsset(code)
        .then((module) => {
          setQrCodeSources((prev) => ({
            ...prev,
            [code]: module.default,
          }));
        })
        .catch(() => {
          setQrCodeLoadErrors((prev) => ({
            ...prev,
            [code]: '二维码加载失败，请重试。',
          }));
        });

      return {
        ...current,
        [code]: true,
      };
    });
  }, []);

  const handleToggleCode = useCallback((code: QrCodeKey) => {
    setVisibleCode((current) => {
      if (current === code) {
        return null;
      }

      loadQrCode(code);
      return code;
    });
  }, [loadQrCode]);

  return {
    visibleCode,
    qrCodeLoadErrors,
    qrCodeSources,
    loadQrCode,
    handleQrCodeImageError,
    handleToggleCode,
  };
};
