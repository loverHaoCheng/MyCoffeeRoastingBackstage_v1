import DownloadOutlined from "@ant-design/icons/DownloadOutlined";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import UploadOutlined from "@ant-design/icons/UploadOutlined";
import App from 'antd/es/app';
import Button from "antd/es/button";
import Modal from 'antd/es/modal';
import Radio from 'antd/es/radio';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { beanEditableDetailQueryKeys, beanQueryKeys } from '@/modules/bean/hooks';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { roastBatchQueryKeys, roastPlanQueryKeys } from '@/modules/roast/hooks';
import { RoastingMachineManager } from '@/modules/roast/components';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import { formatShanghaiBuildVersion } from '@/shared/time/shanghaiTime';
import {
  userDataBackupService,
  type UserDataBackupFile,
  type UserDataBackupImportResult,
  type UserDataBackupImportStrategy,
} from '@/modules/settings/services/userDataBackup.service';

import styles from './SettingsPage.module.css';
import accordionStyles from '../components/SettingsAccordionItem.module.css';

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
  community: {
    alt: '进群交流 bugs 二维码',
    buttonLabel: '进群交流 bugs',
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
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<UserDataBackupFile | null>(null);
  const [backupImportStrategy, setBackupImportStrategy] = useState<UserDataBackupImportStrategy>('merge');
  const backupFileInputRef = useRef<HTMLInputElement | null>(null);
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
  };

  const handleQrCodeImageError = (code: QrCodeKey) => {
    if (code === 'community') {
      setQrCodeLoadErrors((current) => ({
        ...current,
        [code]: '群二维码暂时不可用，请稍后重试。',
      }));
      return;
    }

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

  const getBackupImportSuccessMessage = (result: UserDataBackupImportResult): string => {
    return [
      `新增 ${String(result.imported)} 条`,
      `更新 ${String(result.updated)} 条`,
      `删除 ${String(result.deleted)} 条`,
      `跳过 ${String(result.skipped)} 条`,
    ].join('，');
  };

  const handleDownloadBackup = async () => {
    setIsBackingUp(true);

    try {
      const backup = await userDataBackupService.createBackup();

      userDataBackupService.downloadBackup(backup);
      void message.success('备份文件已生成。');
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '备份失败，请检查登录状态和网络后重试。'));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleImportBackup = async (
    backup: UserDataBackupFile,
    strategy: UserDataBackupImportStrategy,
  ) => {
    setIsImportingBackup(true);

    try {
      const result = await userDataBackupService.importBackup(backup, { strategy });

      queryClient.clear();
      setPendingBackup(null);
      void message.success(`备份上传完成，${getBackupImportSuccessMessage(result)}。`);
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '备份上传失败，请确认文件和当前账号权限。'));
    } finally {
      setIsImportingBackup(false);
    }
  };

  const handleBackupFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) {
      return;
    }

    void userDataBackupService
      .readBackupFile(file)
      .then((backup) => {
        if (userDataBackupService.getImportMode(backup) === 'same-account') {
          setBackupImportStrategy('merge');
          setPendingBackup(backup);
          return;
        }

        modal.confirm({
          cancelText: '取消',
          centered: true,
          content: '跨账号备份会为所有记录重新分配 ID 后新增到当前账号。生豆编号或名称相同也会保留各自数据，不会删除当前账号已有数据。',
          okText: '合并导入备份',
          onOk: async () => {
            await handleImportBackup(backup, 'merge');
          },
          title: '上传备份到当前账号？',
        });
      })
      .catch((error: unknown) => {
        void message.error(getUserFacingErrorMessage(error, '备份文件读取失败，请选择 EasyBake 备份 JSON。'));
      });
  };

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
        <Accordion
          className={accordionStyles.list}
          defaultValue={import.meta.env.MODE === 'test' ? ['appearance'] : []}
          type="single"
        >
          <RoastedBeanConnectionCard />

          <AppearanceSettingsSection />

          <AccordionItem as="section" className={accordionStyles.item} value="roasting-machines">
            <AccordionTrigger
              className={accordionStyles.trigger}
              collapsedAriaLabel="展开"
              expandedAriaLabel="收起"
            >
              <div className={accordionStyles.triggerBody}>
                <div className={accordionStyles.triggerMain}>
                  <div className={accordionStyles.titleGroup}>
                    <h2 className={accordionStyles.title}>烘焙机</h2>
                  </div>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className={accordionStyles.content}>
              <RoastingMachineManager inSettings />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem as="section" className={accordionStyles.item} value="ai-roast">
            <AccordionTrigger
              className={accordionStyles.trigger}
              collapsedAriaLabel="展开"
              disabled
              expandedAriaLabel="收起"
            >
              <div className={accordionStyles.triggerBody}>
                <div className={accordionStyles.triggerMain}>
                  <div className={accordionStyles.titleGroup}>
                    <h2 className={accordionStyles.title}>AI 烘焙能力（筹备中）</h2>
                  </div>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className={accordionStyles.content}>
              <p className={accordionStyles.contentCopy}>
                当前版本先公开入口、规则和数据准备要求。AI 推荐与训练上传会在后续阶段逐步开放。
              </p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

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
          <section aria-label="数据备份" className={styles.backupSection}>
            <Button
              block
              icon={<DownloadOutlined />}
              loading={isBackingUp}
              onClick={() => {
                void handleDownloadBackup();
              }}
            >
              主动备份
            </Button>
            <Button
              block
              icon={<UploadOutlined />}
              loading={isImportingBackup}
              onClick={() => {
                backupFileInputRef.current?.click();
              }}
            >
              主动上传
            </Button>
            <input
              accept="application/json,.json"
              aria-label="选择备份文件"
              className={styles.backupFileInput}
              onChange={handleBackupFileChange}
              ref={backupFileInputRef}
              type="file"
            />
          </section>

          <Modal
            cancelText="取消"
            centered
            confirmLoading={isImportingBackup}
            okText={backupImportStrategy === 'sync' ? '完全同步备份' : '合并导入备份'}
            onCancel={() => {
              if (!isImportingBackup) {
                setPendingBackup(null);
              }
            }}
            onOk={() => {
              if (pendingBackup) {
                void handleImportBackup(pendingBackup, backupImportStrategy);
              }
            }}
            open={pendingBackup != null}
            title="选择备份上传方式"
          >
            <Radio.Group
              className={styles.backupImportOptions}
              onChange={(event) => {
                setBackupImportStrategy(event.target.value as UserDataBackupImportStrategy);
              }}
              value={backupImportStrategy}
            >
              <Radio className={styles.backupImportOption} value="sync">
                <span>完全与备份同步</span>
                <small>新增缺失数据、更新同 ID 数据，并删除当前账号中备份外的数据。适合正式端备份还原到测试端。</small>
              </Radio>
              <Radio className={styles.backupImportOption} value="merge">
                <span>合并备份与账号数据</span>
                <small>只补充当前账号缺少的数据，已有同 ID 数据不会被覆盖，当前账号额外数据会保留。</small>
              </Radio>
            </Radio.Group>
          </Modal>

          <Separator className={styles.footerSeparator} />

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
            {formatShanghaiBuildVersion(appBuildVersion)}
          </p>

          <LegalFooter />
        </div>
      </form>

    </main>
  );
}
