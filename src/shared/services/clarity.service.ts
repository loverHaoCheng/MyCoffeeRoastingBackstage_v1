import Clarity from '@microsoft/clarity';

let isClarityInitialized = false;

/**
 * Initializes Microsoft Clarity when a Vite project ID is configured.
 * The guard keeps startup idempotent (including React StrictMode development mounts).
 */
export const initializeClarity = (): void => {
  if (isClarityInitialized || typeof window === 'undefined') {
    return;
  }

  const projectId = import.meta.env.VITE_CLARITY_PROJECT_ID?.trim();

  if (!projectId) {
    return;
  }

  Clarity.init(projectId);
  isClarityInitialized = true;
};
