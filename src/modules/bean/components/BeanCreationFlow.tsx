import PlusOutlined from '@ant-design/icons/PlusOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import { useCallback, useEffect, useRef, useState } from 'react';

import { createDefaultBeanFormValues } from '@/modules/bean/constants';
import { beanAiRecognitionService } from '@/modules/bean/services';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';
import { ViewportFloatingActionButton } from '@/shared/components/ViewportFloatingActionButton';
import type { BeanImageRecognitionResult, BeanImageRecognitionUsage, GreenBeanCreateInput } from '@/modules/bean/types';

import { BeanAiRecognitionPlaceholder } from './BeanAiRecognitionPlaceholder';
import { BeanManualCreator } from './BeanManualCreator';

import styles from '../pages/BeanPage.module.css';

type BeanCreationMode = 'ai' | 'manual';

interface BeanCreationFlowProps {
  hasCostTemplate: boolean;
  onCreate: (input: GreenBeanCreateInput) => void;
  manualInitialValues?: GreenBeanCreateInput;
  openManualRequestKey?: number | null;
}

const actionSheetStyles = {
  body: {
    paddingBottom: 0,
  },
  content: {
    borderRadius: '28px 28px 0 0',
    overflow: 'hidden',
  },
  wrapper: {
    borderRadius: '28px 28px 0 0',
    overflow: 'hidden',
  },
};

const normalizeAiHarvestSeason = (value: string): string => {
  const trimmed = value.trim();

  if (!trimmed) {
    return '';
  }

  const fullYearMatch = /(?:19|20)\d{2}/.exec(trimmed);

  if (fullYearMatch) {
    return fullYearMatch[0].slice(-2);
  }

  const twoDigitMatch = /\d{2}/.exec(trimmed);

  return twoDigitMatch ? twoDigitMatch[0] : trimmed;
};

const mapAiRecognitionToBeanCreateInput = (recognition: BeanImageRecognitionResult): GreenBeanCreateInput => {
  return {
    ...createDefaultBeanFormValues(),
    altitudeMetersMax: recognition.altitudeMetersMax,
    altitudeMetersMin: recognition.altitudeMetersMin,
    densityGPerL: recognition.densityGPerL,
    displayName: recognition.displayName,
    flavorTags: recognition.flavorTags,
    grade: recognition.grade,
    harvestSeason: normalizeAiHarvestSeason(recognition.harvestSeason),
    millName: recognition.millName,
    moisturePercent: recognition.moisturePercent,
    notes: recognition.notes,
    originArea: recognition.originArea,
    originCountry: recognition.originCountry,
    originRegion: recognition.originRegion,
    processMethod: recognition.processMethod,
    supplierName: recognition.supplierName,
    variety: recognition.variety,
  };
};

export function BeanCreationFlow({
  hasCostTemplate,
  onCreate,
  manualInitialValues,
  openManualRequestKey = null,
}: BeanCreationFlowProps) {
  const { message } = App.useApp();
  const [isCreateActionSheetOpen, setIsCreateActionSheetOpen] = useState(false);
  const [aiRecognitionUsage, setAiRecognitionUsage] = useState<BeanImageRecognitionUsage | null>(null);
  const [aiRecognitionUsageError, setAiRecognitionUsageError] = useState('');
  const [isAiRecognitionUsageLoading, setIsAiRecognitionUsageLoading] = useState(false);
  const [creationDrawerOpen, setCreationDrawerOpen] = useState(false);
  const [creationMode, setCreationMode] = useState<BeanCreationMode>('manual');
  const [recognizedBeanInitialValues, setRecognizedBeanInitialValues] = useState<GreenBeanCreateInput | undefined>();
  const lastHandledManualRequestKeyRef = useRef<null | number>(null);

  const aiRecognitionQuotaText = (() => {
    if (isAiRecognitionUsageLoading) {
      return '额度读取中';
    }

    if (aiRecognitionUsageError) {
      return aiRecognitionUsageError;
    }

    if (!aiRecognitionUsage) {
      return '剩余额度待检测';
    }

    if (!aiRecognitionUsage.enabled) {
      return '当前账号已关闭';
    }

    return `本月剩余 ${String(aiRecognitionUsage.remainingUses)} / ${String(aiRecognitionUsage.monthlyLimit)}`;
  })();
  const isAiRecognitionActionDisabled =
    isAiRecognitionUsageLoading ||
    aiRecognitionUsageError.length > 0 ||
    (aiRecognitionUsage != null && (!aiRecognitionUsage.enabled || aiRecognitionUsage.remainingUses <= 0));

  useEffect(() => {
    if (!isCreateActionSheetOpen) {
      return;
    }

    let shouldIgnore = false;

    setIsAiRecognitionUsageLoading(true);
    setAiRecognitionUsageError('');

    void beanAiRecognitionService
      .getUsage()
      .then((usage) => {
        if (!shouldIgnore) {
          setAiRecognitionUsage(usage);
        }
      })
      .catch((error: unknown) => {
        if (shouldIgnore) {
          return;
        }

        setAiRecognitionUsage(null);
        setAiRecognitionUsageError(`额度读取失败：${getUserFacingErrorMessage(error, '请检查登录态或服务器额度配置')}`);
      })
      .finally(() => {
        if (!shouldIgnore) {
          setIsAiRecognitionUsageLoading(false);
        }
      });

    return () => {
      shouldIgnore = true;
    };
  }, [isCreateActionSheetOpen]);

  const closeCreationDrawer = () => {
    setCreationDrawerOpen(false);
    setCreationMode('manual');
    setRecognizedBeanInitialValues(undefined);
  };

  const openManualCreation = useCallback((initialValues?: GreenBeanCreateInput) => {
    if (!hasCostTemplate) {
      void message.warning('请先前往财务页创建至少一个成本模板，再新增生豆。');
      return;
    }

    setIsCreateActionSheetOpen(false);
    setCreationMode('manual');
    setRecognizedBeanInitialValues(initialValues);
    setCreationDrawerOpen(true);
  }, [hasCostTemplate, message]);

  const openCreationDrawer = (mode: BeanCreationMode) => {
    if (mode === 'ai' && isAiRecognitionActionDisabled) {
      return;
    }

    setIsCreateActionSheetOpen(false);
    setCreationMode(mode);
    setRecognizedBeanInitialValues(undefined);
    setCreationDrawerOpen(true);
  };

  const handleOpenCreateFlow = () => {
    setAiRecognitionUsage(null);
    setAiRecognitionUsageError('');
    if (!hasCostTemplate) {
      void message.warning('请先前往财务页创建至少一个成本模板，再新增生豆。');
      return;
    }

    setIsCreateActionSheetOpen(true);
  };

  const handleApplyAiRecognition = (recognition: BeanImageRecognitionResult) => {
    setRecognizedBeanInitialValues(mapAiRecognitionToBeanCreateInput(recognition));
    setCreationMode('manual');
    void message.success('识别结果已回填，请确认后创建。');
  };

  const handleCreate = (input: GreenBeanCreateInput) => {
    closeCreationDrawer();
    onCreate(input);
  };

  useEffect(() => {
    if (openManualRequestKey == null || openManualRequestKey === lastHandledManualRequestKeyRef.current) {
      return;
    }

    lastHandledManualRequestKeyRef.current = openManualRequestKey;
    openManualCreation(manualInitialValues);
  }, [manualInitialValues, openManualCreation, openManualRequestKey]);

  return (
    <>
      <ViewportFloatingActionButton ariaLabel="新增生豆" icon={<PlusOutlined />} onClick={handleOpenCreateFlow} />

      <AppDrawer
        closable={false}
        className={styles.actionSheet}
        destroyOnHidden
        height={176}
        onClose={() => {
          setIsCreateActionSheetOpen(false);
        }}
        open={isCreateActionSheetOpen}
        placement="bottom"
        showSwipeHandle={false}
        styles={actionSheetStyles}
        title="选择创建方式"
      >
        <div className={styles.actionSheetBody}>
          <div className={styles.actionSheetGroup}>
            <Button block className={styles.actionSheetButton} onClick={() => { openCreationDrawer('manual'); }}>
              手动创建
            </Button>
            <Button
              aria-label="AI 图片识别"
              block
              className={styles.actionSheetButton}
              disabled={isAiRecognitionActionDisabled}
              onClick={() => { openCreationDrawer('ai'); }}
            >
              <span className={styles.actionSheetButtonContent}>
                <span className={styles.actionSheetButtonTitle}>AI 图片识别</span>
                <span className={styles.actionSheetButtonMeta}>{aiRecognitionQuotaText}</span>
              </span>
            </Button>
          </div>
          <div aria-hidden="true" className={styles.actionSheetSpacer} />
          <div className={styles.actionSheetCancelGroup}>
            <Button
              aria-label="取消"
              block
              className={styles.actionSheetButton}
              onClick={() => { setIsCreateActionSheetOpen(false); }}
            >
              取消
            </Button>
          </div>
        </div>
      </AppDrawer>

      <AppDrawer
        className={styles.creationDrawer}
        height="84dvh"
        onClose={closeCreationDrawer}
        open={creationDrawerOpen}
        placement="bottom"
        title={creationMode === 'manual' ? '新增生豆' : 'AI 图片识别'}
      >
        {creationMode === 'manual' ? (
          <BeanManualCreator initialValues={recognizedBeanInitialValues} onCancel={closeCreationDrawer} onCreate={handleCreate} />
        ) : (
          <BeanAiRecognitionPlaceholder onApplyRecognition={handleApplyAiRecognition} />
        )}
      </AppDrawer>
    </>
  );
}
