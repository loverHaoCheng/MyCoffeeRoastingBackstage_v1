import DownloadOutlined from "@ant-design/icons/DownloadOutlined";
import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import UploadOutlined from "@ant-design/icons/UploadOutlined";
import App from 'antd/es/app';
import Button from "antd/es/button";
import Modal from 'antd/es/modal';
import Radio from 'antd/es/radio';
import { useEffect } from 'react';

import { RoastingMachineManager } from '@/modules/roast/components';
import { usePocketBaseConnectionSettings } from '@/modules/settings/hooks';
import { useAppBuildVersion } from '@/app/hooks/useAppBuildVersion';
import { LegalFooter } from '@/modules/legal/components';
import { RoastedBeanConnectionCard } from '@/modules/settings/components/RoastedBeanConnectionCard';
import { AppearanceSettingsSection } from '@/modules/settings/components/AppearanceSettingsSection';
import { FinanceCalculationRulesSection } from '@/modules/settings/components/FinanceCalculationRulesSection';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/shared/components/ui/accordion';
import { Separator } from '@/shared/components/ui/separator';
import { formatShanghaiBuildVersion } from '@/shared/time/shanghaiTime';
import type { UserDataBackupImportStrategy } from '@/modules/settings/services/userDataBackup.service';
import type { QrCodeKey } from '@/modules/settings/services/qrCodeAsset.service';

import { qrCodeEntries } from './SettingsPage/qrCodeConfig';
import { useGreenBeanRefresh } from './SettingsPage/useGreenBeanRefresh';
import { useQrCodeManager } from './SettingsPage/useQrCodeManager';
import { useBackupManager } from './SettingsPage/useBackupManager';
import { useAccountDeletion } from './SettingsPage/useAccountDeletion';
import styles from './SettingsPage.module.css';
import accordionStyles from '../components/SettingsAccordionItem.module.css';

export function SettingsPage() {
  const { message, modal } = App.useApp();
  const appBuildVersion = useAppBuildVersion();
  const { loadPocketBaseConnections, pocketBaseConnections } = usePocketBaseConnectionSettings();
  const { refreshGreenBeanDependencies } = useGreenBeanRefresh();
  const {
    visibleCode,
    qrCodeLoadErrors,
    qrCodeSources,
    loadQrCode,
    handleQrCodeImageError,
    handleToggleCode,
  } = useQrCodeManager();
  const {
    isBackingUp,
    isImportingBackup,
    pendingBackup,
    backupImportStrategy,
    backupFileInputRef,
    handleDownloadBackup,
    handleBackupFileChange,
    setBackupImportStrategy,
    setPendingBackup,
    confirmPendingBackup,
  } = useBackupManager(message, modal);
  const { isDeletingAccount, handleDeleteAccount } = useAccountDeletion(message, modal);

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

  const activeQrEntry = visibleCode ? qrCodeEntries[visibleCode] : null;
  const activeQrCodeError = visibleCode ? qrCodeLoadErrors[visibleCode] : undefined;
  const activeQrCodeSource = visibleCode ? qrCodeSources[visibleCode] : undefined;

  return (
    <main className={styles.page}>
      <h1 className="sr-only">设置</h1>
      <form aria-label="设置表单" className={styles.form}>
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

          <AccordionItem as="section" className={accordionStyles.item} value="ai-roast-guide">
            <AccordionTrigger
              className={accordionStyles.trigger}
              collapsedAriaLabel="展开"
              expandedAriaLabel="收起"
            >
              <div className={accordionStyles.triggerBody}>
                <div className={accordionStyles.triggerMain}>
                  <div className={accordionStyles.titleGroup}>
                    <h2 className={accordionStyles.title}>AI 烘焙功能</h2>
                  </div>
                </div>
              </div>
            </AccordionTrigger>

            <AccordionContent className={accordionStyles.content}>
              <div className={styles.informationList}>
                <article className={styles.informationItem}>
                  <strong>计划模式</strong>
                  <p>选择生豆后，与 AI 讨论烘焙目标与期望风味，生成起始烘焙计划。适合开炉前规划新豆或尝试新烘法。AI 返回的计划草稿需在确认页核对后创建。</p>
                </article>
                <article className={styles.informationItem}>
                  <strong>复盘模式</strong>
                  <p>选择已完成的烘焙记录，AI 结合原计划、实际曲线和杯测评价（如有）分析关键表现，指出影响风味的因素，并生成优化计划供下一炉使用。适合迭代改进现有烘焙方案。</p>
                </article>
                <article className={styles.informationItem}>
                  <strong>常识性提问</strong>
                  <p>不关联生豆或烘焙记录，直接提问咖啡和烘焙的常识性问题，如技术原理、风味判断、设备操作等。适合学习烘焙知识或快速解答疑问。</p>
                </article>
              </div>
              <p className={accordionStyles.contentCopy}>计划和复盘各自按月提供可用次数，常识性提问单独计次。AI 提供的是辅助判断，建议结合实际豆况、设备状态和杯测结果作最终决定。</p>
            </AccordionContent>
          </AccordionItem>

          <FinanceCalculationRulesSection />

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
            onOk={confirmPendingBackup}
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
