import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  aiAnalysisTaskService,
  isActiveAiAnalysisTask,
  type AiAnalysisTaskType,
} from '@/modules/roast/services/aiAnalysisTask.service';

export const aiAnalysisTaskQueryKeys = {
  all: ['ai-analysis-tasks'] as const,
  latest: (roastBatchId: string, taskType: AiAnalysisTaskType) => [
    ...aiAnalysisTaskQueryKeys.all,
    'latest',
    roastBatchId,
    taskType,
  ] as const,
  unnotified: () => [...aiAnalysisTaskQueryKeys.all, 'unnotified'] as const,
};

export function useAiAnalysisTask(roastBatchId: string, taskType: AiAnalysisTaskType) {
  return useQuery({
    enabled: roastBatchId.length > 0,
    queryFn: () => aiAnalysisTaskService.getLatest(roastBatchId, taskType),
    queryKey: aiAnalysisTaskQueryKeys.latest(roastBatchId, taskType),
    refetchInterval: (query) => (isActiveAiAnalysisTask(query.state.data) ? 5_000 : false),
    retry: false,
  });
}

export function useSubmitAiAnalysisTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { adjustmentDirection?: string; roastBatchId: string; taskType: AiAnalysisTaskType }) => {
      return aiAnalysisTaskService.submit(input.roastBatchId, input.taskType, input.adjustmentDirection);
    },
    onSuccess: (task) => {
      queryClient.setQueryData(
        aiAnalysisTaskQueryKeys.latest(task.roastBatchId, task.taskType),
        task,
      );
      void queryClient.invalidateQueries({ queryKey: aiAnalysisTaskQueryKeys.unnotified() });
    },
  });
}
