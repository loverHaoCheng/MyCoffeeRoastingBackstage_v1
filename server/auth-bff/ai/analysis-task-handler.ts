import type { IncomingMessage, ServerResponse } from 'node:http';

import { refreshAuthenticatedSession } from '../auth-common.js';
import { parseJsonBody, sendApiError, sendJson } from '../http.js';
import { PocketBaseGatewayError } from '../types.js';
import { isRecord, toTrimmedString } from '../utils.js';
import {
  acknowledgeAnalysisTasks,
  createOrGetAnalysisTask,
  isTaskType,
  listLatestAnalysisTasks,
  listActiveTasks,
  normalizeAnalysisTaskErrorMessage,
  scheduleAnalysisTaskProcessing,
  toAiAnalysisTaskView,
} from './analysis-task-service.js';
import { resolveRoastAnalysisInput } from './roast-analysis-handler.js';
import { getRequiredSuperuserToken } from './usage-service.js';

const handleTaskError = (response: ServerResponse, error: unknown): void => {
  if (error instanceof PocketBaseGatewayError) {
    const message = normalizeAnalysisTaskErrorMessage(error, 'AI 分析任务处理失败。');
    sendApiError(response, error.status === 404 ? 424 : error.status, message);
    return;
  }

  sendApiError(response, 500, normalizeAnalysisTaskErrorMessage(error, 'AI 分析任务处理失败。'));
};

export const handleCreateAnalysisTask = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const session = await refreshAuthenticatedSession(request, response);

  if (!session) {
    return;
  }

  const payload = await parseJsonBody(request);
  const roastBatchId = isRecord(payload) ? toTrimmedString(payload.roastBatchId) : '';
  const taskType = isRecord(payload) ? payload.taskType : null;

  if (!roastBatchId || !isTaskType(taskType)) {
    sendApiError(response, 400, '缺少有效的烘焙记录 ID 或分析任务类型。');
    return;
  }

  try {
    const superuserToken = await getRequiredSuperuserToken();
    const activeTasks = await listActiveTasks(superuserToken, session.record.id, roastBatchId, taskType);
    const activeTask = activeTasks.length > 0 ? activeTasks[0] : null;

    if (activeTask) {
      const activeView = toAiAnalysisTaskView(activeTask);

      if (activeView) {
        sendJson(response, 202, {
          code: 0,
          data: { task: activeView },
          message: '任务已在处理中，预计需要几分钟。',
        });
        scheduleAnalysisTaskProcessing();
        return;
      }
    }

    const inputPayload = await resolveRoastAnalysisInput(session.token, { roastBatchId });
    const task = await createOrGetAnalysisTask(superuserToken, {
      inputPayload,
      ownerId: session.record.id,
      roastBatchId,
      taskType,
    });

    sendJson(response, 202, {
      code: 0,
      data: { task },
      message: '任务已提交，预计需要几分钟。',
    });
    scheduleAnalysisTaskProcessing();
  } catch (error) {
    handleTaskError(response, error);
  }
};

export const handleListAnalysisTasks = async (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
): Promise<void> => {
  const session = await refreshAuthenticatedSession(request, response);

  if (!session) {
    return;
  }

  const roastBatchId = toTrimmedString(requestUrl.searchParams.get('roastBatchId'));
  const rawTaskType = requestUrl.searchParams.get('taskType');
  const taskType = rawTaskType && isTaskType(rawTaskType) ? rawTaskType : undefined;

  try {
    const tasks = await listLatestAnalysisTasks(session.token, session.record.id, {
      roastBatchId: roastBatchId || undefined,
      taskType,
    });
    const unnotifiedOnly = requestUrl.searchParams.get('unnotified') === 'true';
    const filteredTasks = unnotifiedOnly
      ? tasks.filter((task) => !task.notifiedAt && (task.status === 'completed' || task.status === 'failed'))
      : tasks;

    sendJson(response, 200, {
      code: 0,
      data: { tasks: filteredTasks },
      message: 'ok',
    });
  } catch (error) {
    handleTaskError(response, error);
  }
};

export const handleAcknowledgeAnalysisTasks = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  const session = await refreshAuthenticatedSession(request, response);

  if (!session) {
    return;
  }

  const payload = await parseJsonBody(request);
  const taskIds = isRecord(payload) && Array.isArray(payload.taskIds)
    ? payload.taskIds.map(toTrimmedString).filter(Boolean)
    : [];

  if (taskIds.length === 0) {
    sendApiError(response, 400, '缺少需要确认的任务 ID。');
    return;
  }

  try {
    await acknowledgeAnalysisTasks(session.token, session.record.id, taskIds);
    sendJson(response, 200, {
      code: 0,
      data: { acknowledged: taskIds.length },
      message: 'ok',
    });
  } catch (error) {
    handleTaskError(response, error);
  }
};
