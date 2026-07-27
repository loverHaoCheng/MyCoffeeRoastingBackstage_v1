import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

import { handleDeleteAccount } from './auth-bff/account-handler.js';
import { handleBeanImageRecognitionUsage } from './auth-bff/ai/handler.js';
import { handleRoastAnalysis, handleRoastAnalysisStatus } from './auth-bff/ai/roast-analysis-handler.js';
import { handleRoastAiUsage } from './auth-bff/ai/roast-usage-handler.js';
import { handleRoastPlanRecommendation } from './auth-bff/ai/roast-plan-recommendation-handler.js';
import { handleRoasterModelRecognition } from './auth-bff/ai/roaster-model-recognition-handler.js';
import { handleRoastTrainingQualityCheck } from './auth-bff/ai/roast-training-quality-handler.js';
import { handleRoastTrainingRecommendationConfirm, handleRoastTrainingUpload, handleRoastTrainingUploadStatus } from './auth-bff/ai/roast-training-upload-handler.js';
import { handleConfirmPasswordReset, handleConfirmVerification, handleLogin, handleLogout, handleRegister, handleRequestPasswordReset, handleRequestVerification, handleSession, handleUpdateProfile } from './auth-bff/auth-handlers.js';
import { handleBusinessCollectionRequest } from './auth-bff/collection-handler.js';
import { handleGreenBeanTransactionRequest } from './auth-bff/green-bean-transaction-handler.js';
import { handleRoastBatchTransactionRequest } from './auth-bff/roast-batch-transaction-handler.js';
import { port } from './auth-bff/config.js';
import { RequestBodyTooLargeError, UpstreamTimeoutError, sendJson, sendMethodNotAllowed } from './auth-bff/http.js';
import { handleRealtimeRequest } from './auth-bff/realtime-handler.js';
import { createGatewayRequestHandler } from './auth-bff/router.js';
import { handleUnverifiedUserCleanup } from './auth-bff/unverified-user-cleanup-handler.js';
import { isAuthRateLimited } from './auth-bff/auth-rate-limit.js';

const handleRequest = createGatewayRequestHandler({
  handleAccountDeletion: handleDeleteAccount,
  handleBeanImageRecognition: handleBeanImageRecognitionUsage,
  handleBusinessCollection: handleBusinessCollectionRequest,
  handleRoastBatchTransaction: handleRoastBatchTransactionRequest,
  handleGreenBeanTransaction: handleGreenBeanTransactionRequest,
  handleConfirmPasswordReset,
  handleConfirmVerification,
  handleLogin,
  handleLogout: (request, response) => {
    handleLogout(request, response);
    return Promise.resolve();
  },
  handlePasswordReset: handleRequestPasswordReset,
  handleProfileUpdate: handleUpdateProfile,
  handleRealtime: handleRealtimeRequest,
  handleRegister,
  handleRoastAnalysis,
  handleRoastAiUsage,
  handleRoastAnalysisStatus,
  handleRoastPlanRecommendation,
  handleRoasterModelRecognition,
  handleRoastTrainingQualityCheck,
  handleRoastTrainingRecommendationConfirm,
  handleRoastTrainingUpload,
  handleRoastTrainingUploadStatus,
  handleSession,
  handleUnverifiedUserCleanup,
  handleVerificationRequest: handleRequestVerification,
  isAuthRateLimited,
  sendJson,
  sendMethodNotAllowed,
});

export const handleAuthGatewayRequest = async (
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> => {
  await handleRequest(request, response).catch((error: unknown) => {
    if (response.headersSent) {
      response.destroy(error instanceof Error ? error : undefined);
      return;
    }

    if (error instanceof RequestBodyTooLargeError) {
      sendJson(response, 413, { message: error.message });
      return;
    }

    if (error instanceof UpstreamTimeoutError) {
      sendJson(response, 504, { message: '上游服务响应超时，请稍后重试。' });
      return;
    }

    // 详细异常仅留在运行时日志中，不能回传主机、端口或上游实现信息。
    console.error('Unhandled BFF request error', error);
    sendJson(response, 500, { message: '服务暂时不可用，请稍后重试。' });
  });
};

const isDirectExecution = (): boolean => {
  const entryPath = process.argv[1];

  if (!entryPath) {
    return false;
  }

  try {
    return import.meta.url === pathToFileURL(realpathSync(entryPath)).href;
  } catch {
    return false;
  }
};

const startStandaloneServer = (): void => {
  const server = createServer((request, response) => {
    void handleAuthGatewayRequest(request, response);
  });

  server.on('error', (error: NodeJS.ErrnoException) => {
    const message =
      error.code === 'EADDRINUSE'
        ? `PocketBase auth BFF 启动失败：127.0.0.1:${String(port)} 已被占用。`
        : `PocketBase auth BFF 启动失败：${error.message}`;

    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });

  server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`PocketBase auth BFF is listening on http://127.0.0.1:${String(port)}\n`);
  });
};

if (isDirectExecution()) {
  startStandaloneServer();
};
