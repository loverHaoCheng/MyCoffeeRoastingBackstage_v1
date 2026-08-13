import { httpClient } from '@/services/httpClient';

export type AiAnalysisTaskStatus = 'completed' | 'failed' | 'processing' | 'queued';
export type AiAnalysisTaskType = 'curve_review';

export interface AiAnalysisTask {
  completedAt?: string;
  errorMessage?: string;
  id: string;
  notifiedAt?: string;
  roastBatchId: string;
  startedAt?: string;
  status: AiAnalysisTaskStatus;
  taskType: AiAnalysisTaskType;
}

export const normalizeAiAnalysisTaskErrorMessage = (message: string | undefined, fallbackMessage: string): string => {
  const normalizedMessage = message?.trim().toLowerCase() ?? '';

  if (
    normalizedMessage.includes('missing collection context') ||
    normalizedMessage.includes('collection context') ||
    (normalizedMessage.includes('collection') && normalizedMessage.includes('not found'))
  ) {
    return 'AI 分析任务所需的 PocketBase 集合尚未配置，请联系管理员完成当前环境的集合导入。';
  }

  const trimmedMessage = message?.trim();

  return trimmedMessage?.length ? trimmedMessage : fallbackMessage;
};

interface AnalysisTaskListResult {
  tasks: AiAnalysisTask[];
}

export const isActiveAiAnalysisTask = (task: AiAnalysisTask | null | undefined): boolean => {
  return task?.status === 'queued' || task?.status === 'processing';
};

export const aiAnalysisTaskService = {
  async acknowledge(taskIds: string[]): Promise<void> {
    await httpClient.post('/ai/analysis-tasks/acknowledge', { taskIds });
  },

  async getLatest(roastBatchId: string, taskType: AiAnalysisTaskType): Promise<AiAnalysisTask | null> {
    const searchParams = new URLSearchParams({ roastBatchId, taskType });
    const response = await httpClient.get<AnalysisTaskListResult>(`/ai/analysis-tasks?${searchParams.toString()}`);

    return response.data.tasks[0] ?? null;
  },

  async listUnnotified(): Promise<AiAnalysisTask[]> {
    const response = await httpClient.get<AnalysisTaskListResult>('/ai/analysis-tasks?unnotified=true');
    return response.data.tasks;
  },

  async submit(roastBatchId: string, taskType: AiAnalysisTaskType, adjustmentDirection = ''): Promise<AiAnalysisTask> {
    const response = await httpClient.post<{ task: AiAnalysisTask }>('/ai/analysis-tasks', {
      adjustmentDirection,
      roastBatchId,
      taskType,
    });

    return response.data.task;
  },
};
