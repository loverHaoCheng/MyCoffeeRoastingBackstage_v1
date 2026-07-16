import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { pathToFileURL } from 'node:url';

import { handleDeleteAccount } from './auth-bff/account-handler.js';
import { handleBeanImageRecognitionUsage } from './auth-bff/ai/handler.js';
import { handleRoastTrainingQualityCheck } from './auth-bff/ai/roast-training-quality-handler.js';
import { handleRoastTrainingUpload, handleRoastTrainingUploadStatus } from './auth-bff/ai/roast-training-upload-handler.js';
import { handleConfirmPasswordReset, handleConfirmVerification, handleLogin, handleLogout, handleRegister, handleRequestPasswordReset, handleRequestVerification, handleSession, handleUpdateProfile } from './auth-bff/auth-handlers.js';
import { handleBusinessCollectionRequest } from './auth-bff/collection-handler.js';
import { port } from './auth-bff/config.js';
import { sendJson, sendMethodNotAllowed } from './auth-bff/http.js';
import { handleRealtimeRequest } from './auth-bff/realtime-handler.js';
import { createGatewayRequestHandler } from './auth-bff/router.js';
import { handleUnverifiedUserCleanup } from './auth-bff/unverified-user-cleanup-handler.js';

const handleRequest = createGatewayRequestHandler({
  handleAccountDeletion: handleDeleteAccount,
  handleBeanImageRecognition: handleBeanImageRecognitionUsage,
  handleBusinessCollection: handleBusinessCollectionRequest,
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
  handleRoastTrainingQualityCheck,
  handleRoastTrainingUpload,
  handleRoastTrainingUploadStatus,
  handleSession,
  handleUnverifiedUserCleanup,
  handleVerificationRequest: handleRequestVerification,
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

    const message = error instanceof Error && error.message.trim().length > 0 ? error.message : '登录网关服务异常。';

    sendJson(response, 500, {
      message,
    });
  });
};

const isDirectExecution = (): boolean => {
  const entryPath = process.argv[1];

  return Boolean(entryPath && import.meta.url === pathToFileURL(entryPath).href);
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
