import { normalizeErrorPayload, proxyPocketBaseRequest } from '../pocketbase-client.js';
import { escapeFilterValue, listPocketBaseRecords } from '../record-utils.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';
import { getRequiredSuperuserToken } from './usage-service.js';
import { parseRoastAnalysisPayload } from './roast-analysis-types.js';
import { runRoastAnalysis } from './roast-analysis-handler.js';
import { runRoastTrainingUpload } from './roast-training-upload-handler.js';

export const AI_ANALYSIS_TASKS_COLLECTION = 'ai_analysis_tasks';

export type AiAnalysisTaskStatus = 'completed' | 'failed' | 'processing' | 'queued';
export type AiAnalysisTaskType = 'curve_review' | 'overall_analysis';

export interface AiAnalysisTaskView {
  completedAt?: string;
  errorMessage?: string;
  id: string;
  notifiedAt?: string;
  roastBatchId: string;
  startedAt?: string;
  status: AiAnalysisTaskStatus;
  taskType: AiAnalysisTaskType;
}

interface AiAnalysisTaskRecord extends Record<string, unknown> {
  active_key?: unknown;
  completed_at?: unknown;
  error_message?: unknown;
  id?: unknown;
  input_payload?: unknown;
  notified_at?: unknown;
  owner?: unknown;
  roast_batch_id?: unknown;
  started_at?: unknown;
  status?: unknown;
  task_type?: unknown;
}

const isTaskStatus = (value: unknown): value is AiAnalysisTaskStatus => {
  return value === 'queued' || value === 'processing' || value === 'completed' || value === 'failed';
};

export const normalizeAnalysisTaskErrorMessage = (error: unknown, fallbackMessage: string): string => {
  const rawMessage = error instanceof PocketBaseGatewayError
    ? normalizeErrorPayload(error.payload).message ?? error.message
    : error instanceof Error
      ? error.message
      : '';
  const normalizedMessage = rawMessage.trim().toLowerCase();

  if (
    normalizedMessage.includes('missing collection context') ||
    normalizedMessage.includes('collection context') ||
    (normalizedMessage.includes('collection') && normalizedMessage.includes('not found'))
  ) {
    return 'AI 分析任务所需的 PocketBase 集合尚未配置，请先完成当前环境的集合导入。';
  }

  return rawMessage.trim() || fallbackMessage;
};

export const isTaskType = (value: unknown): value is AiAnalysisTaskType => {
  return value === 'curve_review' || value === 'overall_analysis';
};

const getListItems = (payload: unknown): AiAnalysisTaskRecord[] => {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    return [];
  }

  return payload.items.filter(isRecord);
};

export const toAiAnalysisTaskView = (record: AiAnalysisTaskRecord): AiAnalysisTaskView | null => {
  const id = toTrimmedString(record.id);
  const roastBatchId = toTrimmedString(record.roast_batch_id);
  const status = record.status;
  const taskType = record.task_type;

  if (!id || !roastBatchId || !isTaskStatus(status) || !isTaskType(taskType)) {
    return null;
  }

  return {
    completedAt: toTrimmedString(record.completed_at) || undefined,
    errorMessage: toTrimmedString(record.error_message) || undefined,
    id,
    notifiedAt: toTrimmedString(record.notified_at) || undefined,
    roastBatchId,
    startedAt: toTrimmedString(record.started_at) || undefined,
    status,
    taskType,
  };
};

const updateTaskRecord = async (
  token: string,
  taskId: string,
  payload: Record<string, unknown>,
): Promise<AiAnalysisTaskRecord> => {
  const upstream = await proxyPocketBaseRequest(
    `/api/collections/${AI_ANALYSIS_TASKS_COLLECTION}/records/${encodeURIComponent(taskId)}`,
    {
      body: JSON.stringify(payload),
      headers: {
        Accept: 'application/json',
        Authorization: token,
        'Content-Type': 'application/json',
      },
      method: 'PATCH',
    },
  );

  if (!upstream.response.ok || !isRecord(upstream.payload)) {
    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }

  return upstream.payload;
};

export const listActiveTasks = async (
  token: string,
  ownerId: string,
  roastBatchId: string,
  taskType: AiAnalysisTaskType,
): Promise<AiAnalysisTaskRecord[]> => {
  const payload = await listPocketBaseRecords(token, AI_ANALYSIS_TASKS_COLLECTION, {
    fields: '*',
    filter: [
      `owner = ${escapeFilterValue(ownerId)}`,
      `roast_batch_id = ${escapeFilterValue(roastBatchId)}`,
      `task_type = ${escapeFilterValue(taskType)}`,
      `(status = ${escapeFilterValue('queued')} || status = ${escapeFilterValue('processing')})`,
    ].join(' && '),
    perPage: 10,
    sort: '-created',
  });

  return getListItems(payload);
};

export const createOrGetAnalysisTask = async (
  token: string,
  input: {
    inputPayload: unknown;
    ownerId: string;
    roastBatchId: string;
    taskType: AiAnalysisTaskType;
  },
): Promise<AiAnalysisTaskView> => {
  const activeTasks = await listActiveTasks(token, input.ownerId, input.roastBatchId, input.taskType);
  const activeView = activeTasks.length === 0 ? null : toAiAnalysisTaskView(activeTasks[0]);

  if (activeView) {
    return activeView;
  }

  const upstream = await proxyPocketBaseRequest(`/api/collections/${AI_ANALYSIS_TASKS_COLLECTION}/records`, {
    body: JSON.stringify({
      active_key: 'active',
      completed_at: '',
      error_message: '',
      input_payload: input.inputPayload,
      notified_at: '',
      owner: input.ownerId,
      roast_batch_id: input.roastBatchId,
      started_at: '',
      status: 'queued',
      task_type: input.taskType,
    }),
    headers: {
      Accept: 'application/json',
      Authorization: token,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  if (!upstream.response.ok || !isRecord(upstream.payload)) {
    if (upstream.response.status === 400) {
      const concurrentTasks = await listActiveTasks(token, input.ownerId, input.roastBatchId, input.taskType);
      const concurrentView = concurrentTasks.length === 0 ? null : toAiAnalysisTaskView(concurrentTasks[0]);

      if (concurrentView) {
        return concurrentView;
      }
    }

    throw new PocketBaseGatewayError(upstream.response.status, upstream.payload);
  }

  const created = toAiAnalysisTaskView(upstream.payload);

  if (!created) {
    throw new PocketBaseGatewayError(502, { message: 'AI 分析任务创建响应无效。' });
  }

  return created;
};

export const listLatestAnalysisTasks = async (
  token: string,
  ownerId: string,
  options: { roastBatchId?: string; taskType?: AiAnalysisTaskType } = {},
): Promise<AiAnalysisTaskView[]> => {
  const filters = [`owner = ${escapeFilterValue(ownerId)}`];

  if (options.roastBatchId) {
    filters.push(`roast_batch_id = ${escapeFilterValue(options.roastBatchId)}`);
  }

  if (options.taskType) {
    filters.push(`task_type = ${escapeFilterValue(options.taskType)}`);
  }

  const payload = await listPocketBaseRecords(token, AI_ANALYSIS_TASKS_COLLECTION, {
    fields: '*',
    filter: filters.join(' && '),
    perPage: options.roastBatchId && options.taskType ? 1 : 50,
    sort: '-created',
  });

  return getListItems(payload)
    .map(toAiAnalysisTaskView)
    .filter((task): task is AiAnalysisTaskView => task != null);
};

export const acknowledgeAnalysisTasks = async (
  readToken: string,
  ownerId: string,
  taskIds: string[],
): Promise<void> => {
  const tasks = await listLatestAnalysisTasks(readToken, ownerId);
  const ownedIds = new Set(tasks.map((task) => task.id));
  const notifiedAt = new Date().toISOString();
  const updateToken = await getRequiredSuperuserToken();

  for (const taskId of [...new Set(taskIds)]) {
    if (ownedIds.has(taskId)) {
      await updateTaskRecord(updateToken, taskId, { notified_at: notifiedAt });
    }
  }
};

let workerPromise: Promise<void> | null = null;
let workerInterval: NodeJS.Timeout | null = null;

const processTaskRecord = async (token: string, task: AiAnalysisTaskRecord): Promise<void> => {
  const taskId = toTrimmedString(task.id);
  const ownerId = toTrimmedString(task.owner);
  const roastBatchId = toTrimmedString(task.roast_batch_id);
  const taskType = task.task_type;

  if (!taskId || !ownerId || !roastBatchId || !isTaskType(taskType)) {
    return;
  }

  await updateTaskRecord(token, taskId, {
    error_message: '',
    started_at: new Date().toISOString(),
    status: 'processing',
  });

  try {
    let result: unknown;
    let resultRecordId = '';

    if (taskType === 'curve_review') {
      const analysisResult = await runRoastAnalysis(
        token,
        ownerId,
        parseRoastAnalysisPayload(task.input_payload),
      );
      result = analysisResult;
      resultRecordId = toTrimmedString(analysisResult.reviewId);
    } else {
      const inputPayload = isRecord(task.input_payload) ? task.input_payload : {};
      const trainingResult = await runRoastTrainingUpload(token, ownerId, roastBatchId, {
        adjustmentDirection: toTrimmedString(inputPayload.adjustmentDirection).slice(0, 1000),
        createTrainingSample: false,
      });
      result = trainingResult;
      resultRecordId = toTrimmedString(trainingResult.uploadId);
    }

    await updateTaskRecord(token, taskId, {
      active_key: `done-${taskId}`,
      completed_at: new Date().toISOString(),
      result_payload: result,
      result_record_id: resultRecordId,
      status: 'completed',
    });
  } catch (error) {
    const fallbackMessage = taskType === 'curve_review' ? 'AI 曲线复盘失败。' : '整体复盘与计划建议生成失败。';
    const errorMessage = normalizeAnalysisTaskErrorMessage(error, fallbackMessage);

    await updateTaskRecord(token, taskId, {
      active_key: `failed-${taskId}`,
      completed_at: new Date().toISOString(),
      error_message: errorMessage.slice(0, 500),
      status: 'failed',
    });
  }
};

export const processPendingAnalysisTasks = async (): Promise<void> => {
  if (workerPromise) {
    return workerPromise;
  }

  workerPromise = (async () => {
    try {
      const token = await getRequiredSuperuserToken();
      const payload = await listPocketBaseRecords(token, AI_ANALYSIS_TASKS_COLLECTION, {
        fields: '*',
        filter: `(status = ${escapeFilterValue('queued')} || status = ${escapeFilterValue('processing')})`,
        perPage: 20,
        sort: 'created',
      });

      for (const task of getListItems(payload)) {
        try {
          await processTaskRecord(token, task);
        } catch (error) {
          process.stderr.write(`AI analysis task ${toTrimmedString(task.id) || 'unknown'} failed to process: ${error instanceof Error ? error.message : String(error)}\n`);
        }
      }
    } catch (error) {
      process.stderr.write(`AI analysis task worker failed: ${error instanceof Error ? error.message : String(error)}\n`);
    } finally {
      workerPromise = null;
    }
  })();

  return workerPromise;
};

export const scheduleAnalysisTaskProcessing = (): void => {
  setTimeout(() => {
    void processPendingAnalysisTasks();
  }, 0);
};

export const startAnalysisTaskWorker = (): void => {
  if (workerInterval) {
    return;
  }

  scheduleAnalysisTaskProcessing();
  workerInterval = setInterval(() => {
    void processPendingAnalysisTasks();
  }, 5_000);
  workerInterval.unref();
};
