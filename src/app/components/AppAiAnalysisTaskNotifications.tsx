import { useQuery, useQueryClient } from '@tanstack/react-query';
import App from 'antd/es/app';
import { useEffect, useRef } from 'react';

import { aiAnalysisTaskQueryKeys } from '@/modules/roast/hooks/useAiAnalysisTask';
import { roastTrainingUploadQueryKeys } from '@/modules/roast/hooks/useRoastTrainingUpload';
import {
  aiAnalysisTaskService,
  normalizeAiAnalysisTaskErrorMessage,
} from '@/modules/roast/services/aiAnalysisTask.service';
import { roastAnalysisService } from '@/modules/roast/services/roastAnalysis.service';
import { roastTrainingUploadService } from '@/modules/roast/services/roastTrainingUpload.service';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';

const completionMessages = {
  curve_review: 'AI 曲线复盘已完成。',
  overall_analysis: '整体复盘与计划建议已完成。',
} as const;

const failureMessages = {
  curve_review: 'AI 曲线复盘生成失败，请重新提交。',
  overall_analysis: '整体复盘与计划建议生成失败，请重新提交。',
} as const;

const waitForNextPaint = async (): Promise<void> => {
  if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
    return;
  }

  await new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      resolve();
    });
  });
};

export function AppAiAnalysisTaskNotifications() {
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const isAuthenticated = useAuthStore((state) => state.status === 'authenticated');
  const displayedTaskIdsRef = useRef(new Set<string>());
  const handlingTaskIdsRef = useRef(new Set<string>());
  const tasksQuery = useQuery({
    enabled: isAuthenticated,
    queryFn: () => aiAnalysisTaskService.listUnnotified(),
    queryKey: aiAnalysisTaskQueryKeys.unnotified(),
    refetchInterval: isAuthenticated ? 5_000 : false,
    retry: false,
  });

  useEffect(() => {
    const nextTasks = (tasksQuery.data ?? []).filter(
      (task) => !displayedTaskIdsRef.current.has(task.id) && !handlingTaskIdsRef.current.has(task.id),
    );

    if (nextTasks.length === 0) {
      return;
    }

    nextTasks.forEach((task) => handlingTaskIdsRef.current.add(task.id));

    const hydrateAndNotify = async () => {
      for (const task of nextTasks) {
        try {
          if (task.status === 'completed') {
            if (task.taskType === 'curve_review') {
              const result = await queryClient.fetchQuery({
                queryFn: () => roastAnalysisService.getStatusDetail(task.roastBatchId),
                queryKey: ['roast-analysis', task.roastBatchId],
                retry: 2,
                staleTime: 0,
              });

              if (!result.analysis) {
                throw new Error('AI 曲线复盘结果尚未同步到前端。');
              }
            } else {
              const result = await queryClient.fetchQuery({
                queryFn: async () => (await roastTrainingUploadService.getStatus(task.roastBatchId)).data,
                queryKey: roastTrainingUploadQueryKeys.status(task.roastBatchId),
                retry: 2,
                staleTime: 0,
              });

              if (!result.recommendations?.length) {
                throw new Error('整体复盘与计划建议结果尚未同步到前端。');
              }
            }
          } else if (task.taskType === 'curve_review') {
            await queryClient.invalidateQueries({ queryKey: ['roast-analysis', task.roastBatchId] });
          } else {
            await queryClient.invalidateQueries({
              queryKey: roastTrainingUploadQueryKeys.status(task.roastBatchId),
            });
          }

          await queryClient.invalidateQueries({
            queryKey: aiAnalysisTaskQueryKeys.latest(task.roastBatchId, task.taskType),
          });
          await waitForNextPaint();
          displayedTaskIdsRef.current.add(task.id);

          if (task.status === 'completed') {
            void message.success(completionMessages[task.taskType], 5);
          } else {
            void message.error(
              normalizeAiAnalysisTaskErrorMessage(task.errorMessage, failureMessages[task.taskType]),
              5,
            );
          }

          await aiAnalysisTaskService.acknowledge([task.id]);
        } catch {
          // Keep the task unacknowledged so the next poll retries hydration before notifying.
          displayedTaskIdsRef.current.delete(task.id);
        } finally {
          handlingTaskIdsRef.current.delete(task.id);
        }
      }

      void queryClient.invalidateQueries({ queryKey: aiAnalysisTaskQueryKeys.unnotified() });
    };

    void hydrateAndNotify();
  }, [message, queryClient, tasksQuery.data]);

  return null;
}
