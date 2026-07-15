let hasShownEnvironmentGuidanceOnCurrentPage = false;

export const hasShownEnvironmentGuidance = (): boolean => {
  return hasShownEnvironmentGuidanceOnCurrentPage;
};

export const markEnvironmentGuidanceAsShown = (): void => {
  hasShownEnvironmentGuidanceOnCurrentPage = true;
};

export const resetEnvironmentGuidanceDisplayForTest = (): void => {
  hasShownEnvironmentGuidanceOnCurrentPage = false;
};
