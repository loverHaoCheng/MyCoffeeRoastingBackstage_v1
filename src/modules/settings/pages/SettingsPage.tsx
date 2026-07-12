import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import { App } from 'antd';
import Button from "antd/es/button";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { beanEditableDetailQueryKeys, beanQueryKeys } from '@/modules/bean/hooks';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { roastBatchQueryKeys, roastPlanQueryKeys } from '@/modules/roast/hooks';
import { usePocketBaseConnectionSettings } from '@/modules/settings/hooks';
import {
  loadQrCodeAsset,
  loadQrCodeFallbackAsset,
  type QrCodeKey,
} from '@/modules/settings/services/qrCodeAsset.service';
import { useAppBuildVersion } from '@/app/hooks/useAppBuildVersion';
import { LegalFooter } from '@/modules/legal/components';
import { RoastedBeanConnectionCard } from '@/modules/settings/components/RoastedBeanConnectionCard';
import { AppearanceSettingsSection } from '@/modules/settings/components/AppearanceSettingsSection';

import styles from './SettingsPage.module.css';

const qrCodeEntries: Record<
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
  sponsor: {
    alt: '赞助支持二维码',
    buttonLabel: '请作者喝杯咖啡',
  },
};

export function SettingsPage() {
  const { message, modal } = App.useApp();
  const queryClient = useQueryClient();
  const appBuildVersion = useAppBuildVersion();
  const { loadPocketBaseConnections, pocketBaseConnections } = usePocketBaseConnectionSettings();
  const deleteAccount = useAuthStore((state) => state.deleteAccount);
  const lastGreenBeanRefreshSignatureRef = useRef('');
  const [visibleCode, setVisibleCode] = useState<null | QrCodeKey>(null);
  const [qrCodeFallbackTried, setQrCodeFallbackTried] = useState<Partial<Record<QrCodeKey, boolean>>>({});
  const [qrCodeLoadErrors, setQrCodeLoadErrors] = useState<Partial<Record<QrCodeKey, string>>>({});
  const [qrCodeSources, setQrCodeSources] = useState<Partial<Record<QrCodeKey, string>>>({});
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const refreshGreenBeanDependencies = useCallback((connectionSignature: string) => {
    if (!connectionSignature || lastGreenBeanRefreshSignatureRef.current === connectionSignature) {
      return;
    }

    lastGreenBeanRefreshSignatureRef.current = connectionSignature;
    queryClient.removeQueries({ queryKey: beanQueryKeys.all });
    queryClient.removeQueries({ queryKey: beanEditableDetailQueryKeys.all });
    queryClient.removeQueries({ queryKey: roastPlanQueryKeys.all });
    queryClient.removeQueries({ queryKey: roastBatchQueryKeys.all });
  }, [queryClient]);

  useEffect(() => {
    void loadPocketBaseConnections();
  }, [loadPocketBaseConnections]);

  useEffect(() => {
    const projectUrl = pocketBaseConnections.greenBean.projectUrl.trim();

    if (projectUrl.length === 0) {
      return;
    }

    const signature = JSON.stringify({ projectUrl });

    refreshGreenBeanDependencies(signature);
  }, [
    refreshGreenBeanDependencies,
    pocketBaseConnections.greenBean.projectUrl,
  ]);

  const loadQrCode = (code: QrCodeKey) => {
    if (qrCodeSources[code]) {
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
  };

  const handleQrCodeImageError = (code: QrCodeKey) => {
    if (qrCodeFallbackTried[code]) {
      setQrCodeLoadErrors((current) => ({
        ...current,
        [code]: '二维码加载失败，请重试。',
      }));
      return;
    }

    setQrCodeFallbackTried((current) => ({
      ...current,
      [code]: true,
    }));

    void loadQrCodeFallbackAsset(code)
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
  };

  const handleToggleCode = (code: QrCodeKey) => {
    if (visibleCode === code) {
      setVisibleCode(null);
      return;
    }

    setVisibleCode(code);
    loadQrCode(code);
  };

  const activeQrEntry = visibleCode ? qrCodeEntries[visibleCode] : null;
  const activeQrCodeError = visibleCode ? qrCodeLoadErrors[visibleCode] : undefined;
  const activeQrCodeSource = visibleCode ? qrCodeSources[visibleCode] : undefined;

  const handleDeleteAccount = () => {
    let remainingSeconds = 5;
    let countdownTimer: number | null = null;

    const clearCountdown = () => {
      if (countdownTimer != null) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
      }
    };

    const modalInstance = modal.confirm({
      cancelText: '取消',
      centered: true,
      content:
        '你的账号、烘焙业务数据、财务记录、库存设置和关联配置都会被永久删除，且无法恢复。请确认你已经完成导出或备份。',
      maskClosable: false,
      okButtonProps: {
        danger: true,
        disabled: true,
      },
      okText: `确认注销（${String(remainingSeconds)}s）`,
      onCancel: () => {
        clearCountdown();
      },
      onOk: async () => {
        clearCountdown();
        setIsDeletingAccount(true);

        try {
          await deleteAccount();
          queryClient.clear();
          void message.success('账号已注销，所有关联数据已删除。');
        } catch (error) {
          void message.error(getUserFacingErrorMessage(error, '账号注销失败，请稍后重试。'));
        } finally {
          setIsDeletingAccount(false);
        }
      },
      title: '确认注销账号？',
    });

    countdownTimer = window.setInterval(() => {
      remainingSeconds -= 1;

      if (remainingSeconds <= 0) {
        clearCountdown();
        modalInstance.update({
          okButtonProps: {
            danger: true,
            disabled: false,
          },
          okText: '确认注销',
        });
        return;
      }

      modalInstance.update({
        okButtonProps: {
          danger: true,
          disabled: true,
        },
        okText: `确认注销（${String(remainingSeconds)}s）`,
      });
    }, 1000);
  };

  return (
    <main className={styles.page}>
      <form className={styles.form}>
        <RoastedBeanConnectionCard />

        <AppearanceSettingsSection />

        <section className={styles.qrSection} data-expanded={visibleCode ? 'true' : 'false'}>
          <div className={styles.qrActions}>
            {(Object.entries(qrCodeEntries) as [QrCodeKey, (typeof qrCodeEntries)[QrCodeKey]][]).map(([code, entry]) => (
              <Button
                aria-pressed={visibleCode === code}
                className={styles.qrButton}
                key={code}
                onClick={() => {
                  handleToggleCode(code);
                }}
                type={visibleCode === code ? 'primary' : 'default'}
              >
                {entry.buttonLabel}
              </Button>
            ))}
          </div>

          <div aria-hidden={!visibleCode} className={styles.sectionCollapse} data-collapsed={!visibleCode}>
            <div className={styles.sectionCollapseInner}>
              {activeQrEntry ? (
                <div className={styles.qrPanel}>
                  <div className={styles.qrCard} key={visibleCode}>
                    {activeQrCodeSource ? (
                      <img
                        alt={activeQrEntry.alt}
                        className={styles.qrImage}
                        onError={() => {
                          if (visibleCode) {
                            handleQrCodeImageError(visibleCode);
                          }
                        }}
                        src={activeQrCodeSource}
                      />
                    ) : activeQrCodeError && visibleCode ? (
                      <div className={styles.qrLoadError} role="alert">
                        <span>{activeQrCodeError}</span>
                        <Button
                          onClick={() => {
                            loadQrCode(visibleCode);
                          }}
                          type="default"
                        >
                          重新加载二维码
                        </Button>
                      </div>
                    ) : (
                      <div aria-label="正在加载二维码" className={styles.qrLoading} role="status" />
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </section>

        <div className={styles.footerStack}>
          <section className={styles.dangerSection}>
            <Button
              block
              danger
              icon={<DeleteOutlined />}
              loading={isDeletingAccount}
              onClick={handleDeleteAccount}
            >
              注销账号
            </Button>
          </section>

          <p className={styles.buildVersion}>
            当前 Web 上传版本：
            {appBuildVersion}
          </p>

          <LegalFooter />
        </div>
      </form>

    </main>
  );
}
