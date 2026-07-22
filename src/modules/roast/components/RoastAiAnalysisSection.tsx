import App from 'antd/es/app';
import Button from 'antd/es/button';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useRoastCurve, useRoastPlans, useRoastingMachines } from '@/modules/roast/hooks';
import { roastAnalysisService, type RoastAnalysisResult } from '@/modules/roast/services/roastAnalysis.service';
import { isRoastAiClientEnabled } from '@/modules/roast/services/roastTrainingUpload.service';
import type { RoastBatchRecord } from '@/modules/roast/types/roastBatch';
import { buildRoastAnalysisRequest } from '@/modules/roast/utils/roastAnalysisPayload';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './RoastBatchDrawer.module.css';

interface RoastAiAnalysisSectionProps {
  batch: RoastBatchRecord;
}

const issueCategoryLabels: Record<string, string> = {
  data_integrity: '曲线记录',
  development: '发展期',
  drying: '干燥期',
  dropTemperature: '出炉温度',
  drop_temperature: '出炉温度',
  energy: '能量供应',
  ror: '升温率',
  ror_consistency: '升温率记录',
};

const severityLabels: Record<'high' | 'low' | 'medium', string> = {
  high: '高优先级',
  low: '低优先级',
  medium: '中优先级',
};

const humanReadableTextReplacements: [RegExp, string][] = [
  [/\bdata_integrity\b/gi, '曲线记录'],
  [/\bror_consistency\b/gi, '升温率记录'],
  [/\broast\.totalTimeSeconds\b/g, '总烘焙时长'],
  [/\bcurve\.samples\b/g, '曲线采样点'],
  [/\bsignals\.dropTemperatureC\b/g, '下豆温度记录'],
  [/\bsignals\b/g, '曲线摘要'],
  [/\brorStats\.averagePositive\b/g, '平均正向升温率'],
  [/\brorStats\.firstCrack\b/g, '一爆时升温率'],
  [/\brorStats\.drop\b/g, '下豆时升温率'],
  [/\brorStats\.end\b/g, '末段升温率'],
  [/\brorStats\b/g, '升温率统计'],
  [/\btimeSeconds\b/g, '时间点'],
  [/\bbeanTemperature\b/g, '豆温'],
  [/\brateOfRise\b/g, '升温率'],
  [/\bRoR\b/g, '升温率'],
  [/\bROR\b/g, '升温率'],
  [/\bend ROR\b/gi, '末段升温率'],
  [/\bend RoR\b/gi, '末段升温率'],
  [/\bend\b/g, '末段'],
  [/\bdrop\b/g, '下豆'],
  [/末段\s+升温率/g, '末段升温率'],
  [/升温率\s+末段/g, '末段升温率'],
];

const toHumanIssueCategory = (category: string): string => {
  const normalized = category.toLowerCase().replaceAll(' ', '_').replaceAll('-', '_');
  return issueCategoryLabels[category] ?? issueCategoryLabels[normalized] ?? category;
};

const toHumanReadableRoastText = (text: string): string => {
  return humanReadableTextReplacements.reduce((result, [pattern, replacement]) => result.replace(pattern, replacement), text);
};

function RoastAiAnalysisSectionContent({ batch }: RoastAiAnalysisSectionProps) {
  const { message } = App.useApp();
  const { data: plans = [] } = useRoastPlans();
  const { data: machines = [] } = useRoastingMachines();
  const curveQuery = useRoastCurve(batch.id);
  const [analysis, setAnalysis] = useState<RoastAnalysisResult | null>(null);
  const savedAnalysisQuery = useQuery({ queryKey: ['roast-analysis', batch.id], queryFn: () => roastAnalysisService.getStatus(batch.id) });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const plan = plans.find((item) => item.id === batch.roastPlanId);
  const machine = machines.find((item) => item.id === plan?.roasterMachineId);
  const curve = curveQuery.data;
  const displayedAnalysis = analysis ?? savedAnalysisQuery.data ?? null;
  const hasUploadedCurve = Boolean(curve?.id && curve.curveData.length > 0);
  const canAnalyze = Boolean(plan && machine && hasUploadedCurve && batch.totalRoastTime && batch.totalRoastTime > 0 && !displayedAnalysis);

  const handleAnalyze = async () => {
    if (!plan || !machine || !curve || !hasUploadedCurve || !batch.totalRoastTime) {
      void message.warning('请先关联烘焙计划、烘焙机并导入曲线后再生成复盘。');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await roastAnalysisService.analyze(buildRoastAnalysisRequest(batch, curve, plan, machine));
      setAnalysis(result);
    } catch (error: unknown) {
      void message.error(getUserFacingErrorMessage(error, 'AI 曲线复盘失败，请稍后重试。'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.section}>
      <h4>AI 曲线复盘</h4>
      <p className={styles.trainingSummary}>结合原计划和实际曲线，分析明显瑕疵、预测杯中表现，并给出杯测关注点与下一炉曲线调整策略。</p>
      {!displayedAnalysis ? <Button disabled={!canAnalyze} loading={isSubmitting || curveQuery.isLoading || savedAnalysisQuery.isLoading} onClick={() => void handleAnalyze()}>生成 AI 曲线复盘</Button> : null}
      {!displayedAnalysis && !canAnalyze ? <p className={styles.trainingHint}>需要已关联烘焙计划、实体烘焙机和曲线数据。</p> : null}
      {displayedAnalysis ? (
        <div className={styles.trainingGrid}>
          <article className={styles.trainingItem}>
            <strong>复盘摘要</strong>
            <p>{toHumanReadableRoastText(displayedAnalysis.summary)}</p>
          </article>
          <article className={styles.trainingItem}>
            <strong>主调整</strong>
            <span>置信度 {String(displayedAnalysis.confidence)}%</span>
            <p>{toHumanReadableRoastText(displayedAnalysis.primaryAdjustment.action)}</p>
            <p>{toHumanReadableRoastText(displayedAnalysis.primaryAdjustment.rationale)}</p>
          </article>
          {displayedAnalysis.issues.map((issue) => (
            <article className={styles.trainingItem} key={`${issue.category}-${issue.evidence}`}>
              <strong>{toHumanIssueCategory(issue.category)}</strong>
              <span>{severityLabels[issue.severity]}</span>
              <p>{toHumanReadableRoastText(issue.evidence)}</p>
            </article>
          ))}
          {displayedAnalysis.nextRoastAdjustments.length > 0 ? (
            <article className={styles.trainingItem}>
              <strong>下次建议</strong>
              <ol className={styles.aiRecommendationList}>
                {displayedAnalysis.nextRoastAdjustments.map((adjustment) => <li key={adjustment}>{toHumanReadableRoastText(adjustment)}</li>)}
              </ol>
            </article>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export function RoastAiAnalysisSection(props: RoastAiAnalysisSectionProps) {
  if (!isRoastAiClientEnabled()) {
    return null;
  }

  return <RoastAiAnalysisSectionContent {...props} />;
}
