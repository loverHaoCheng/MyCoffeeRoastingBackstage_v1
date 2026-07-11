import type { RoastPlan } from '@/types/domain';

export const GENERIC_ROAST_PLAN_BEAN_ID = 'generic';

export const isGenericRoastPlan = (plan: RoastPlan): boolean => {
  return String(plan.beanId) === GENERIC_ROAST_PLAN_BEAN_ID || plan.beanName.trim() === '通用';
};

export const getSelectableRoastPlans = (
  plans: RoastPlan[],
  greenBeanId: string | undefined,
): RoastPlan[] => {
  const normalizedGreenBeanId = greenBeanId?.trim() ?? '';

  return plans.filter((plan) => {
    if (isGenericRoastPlan(plan)) {
      return true;
    }

    return normalizedGreenBeanId.length > 0 && String(plan.beanId) === normalizedGreenBeanId;
  });
};
