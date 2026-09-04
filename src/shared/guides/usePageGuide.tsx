import { useCallback, useEffect, useMemo } from 'react';
import { driver } from 'driver.js';
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined';
import type { ReactNode } from 'react';

import { pageGuideDefinitions } from './pageGuides';

export function usePageGuide(pathname: string) {
  const definition = useMemo(() => {
    const exact = pageGuideDefinitions[pathname];
    if (exact) return exact;
    return Object.entries(pageGuideDefinitions).find(([path]) => pathname.startsWith(`${path}/`))?.[1];
  }, [pathname]);

  const startGuide = useCallback(() => {
    if (!definition) return;
    const steps = definition.steps.filter((guideStep) => {
      if (!guideStep.element || typeof guideStep.element !== 'string') return true;
      return Boolean(document.querySelector(guideStep.element));
    });
    if (steps.length === 0) return;
    const tour = driver({
      allowClose: true,
      animate: true,
      doneBtnText: '完成',
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      progressText: '{{current}} / {{total}}',
      showProgress: true,
      steps,
    });
    tour.drive();
  }, [definition]);

  useEffect(() => () => {
    document.querySelector('.driver-active-element')?.classList.remove('driver-active-element');
  }, [pathname]);

  return {
    action: definition ? { ariaLabel: '查看当前页面引导', icon: <QuestionCircleOutlined /> as ReactNode, onClick: startGuide } : null,
    title: definition?.title,
  };
}
