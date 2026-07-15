import type { IncomingMessage, ServerResponse } from 'node:http';

type RequestHandler = (request: IncomingMessage, response: ServerResponse) => Promise<void>;
type BusinessCollectionHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  requestUrl: URL,
) => Promise<boolean>;

interface GatewayRouteHandlers {
  handleAccountDeletion: RequestHandler;
  handleBeanImageRecognition: RequestHandler;
  handleBusinessCollection: BusinessCollectionHandler;
  handleConfirmPasswordReset: RequestHandler;
  handleConfirmVerification: RequestHandler;
  handleLogin: RequestHandler;
  handleLogout: RequestHandler;
  handlePasswordReset: RequestHandler;
  handleProfileUpdate: RequestHandler;
  handleRealtime: RequestHandler;
  handleRegister: RequestHandler;
  handleSession: RequestHandler;
  handleUnverifiedUserCleanup: RequestHandler;
  handleVerificationRequest: RequestHandler;
  sendJson: (response: ServerResponse, statusCode: number, body: unknown) => void;
  sendMethodNotAllowed: (response: ServerResponse, allowedMethods: string[]) => void;
}

const ensureMethod = (
  request: IncomingMessage,
  response: ServerResponse,
  allowedMethods: string[],
  handlers: GatewayRouteHandlers,
): boolean => {
  if (allowedMethods.includes(request.method ?? '')) {
    return true;
  }

  handlers.sendMethodNotAllowed(response, allowedMethods);
  return false;
};

export const createGatewayRequestHandler = (handlers: GatewayRouteHandlers): RequestHandler => {
  return async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const path = requestUrl.pathname;

    if (path === '/api/health' && request.method === 'GET') {
      handlers.sendJson(response, 200, { ok: true });
      return;
    }

    if (path === '/internal/jobs/cleanup-unverified-users') {
      if (ensureMethod(request, response, ['POST'], handlers)) {
        await handlers.handleUnverifiedUserCleanup(request, response);
      }
      return;
    }

    if (path === '/api/ai/bean-image-recognition') {
      if (ensureMethod(request, response, ['GET', 'POST'], handlers)) {
        await handlers.handleBeanImageRecognition(request, response);
      }
      return;
    }

    const authRoutes: Partial<Record<string, { allowedMethods: string[]; handler: RequestHandler }>> = {
      '/api/auth/account': { allowedMethods: ['DELETE'], handler: handlers.handleAccountDeletion },
      '/api/auth/confirm-password-reset': { allowedMethods: ['POST'], handler: handlers.handleConfirmPasswordReset },
      '/api/auth/confirm-verification': { allowedMethods: ['POST'], handler: handlers.handleConfirmVerification },
      '/api/auth/login': { allowedMethods: ['POST'], handler: handlers.handleLogin },
      '/api/auth/logout': { allowedMethods: ['POST'], handler: handlers.handleLogout },
      '/api/auth/profile': { allowedMethods: ['PATCH'], handler: handlers.handleProfileUpdate },
      '/api/auth/register': { allowedMethods: ['POST'], handler: handlers.handleRegister },
      '/api/auth/request-password-reset': { allowedMethods: ['POST'], handler: handlers.handlePasswordReset },
      '/api/auth/request-verification': { allowedMethods: ['POST'], handler: handlers.handleVerificationRequest },
      '/api/auth/session': { allowedMethods: ['GET'], handler: handlers.handleSession },
    };
    const authRoute = authRoutes[path];

    if (authRoute) {
      if (ensureMethod(request, response, authRoute.allowedMethods, handlers)) {
        await authRoute.handler(request, response);
      }
      return;
    }

    if (path === '/api/realtime') {
      await handlers.handleRealtime(request, response);
      return;
    }

    if (await handlers.handleBusinessCollection(request, response, requestUrl)) {
      return;
    }

    handlers.sendJson(response, 404, { message: 'Not Found' });
  };
};
