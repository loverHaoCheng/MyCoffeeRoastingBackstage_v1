import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RoastBatchRecord } from '../../types';
import type { RoastConversationMode } from '../../services/roastConversation.service';
import { resolveRouteMode } from './modeUtils';

export const useRouteSync = (
  routeBatch: RoastBatchRecord | undefined,
  setDisplayedBeanId: (value: string | undefined) => void,
  setIsNewConversation: (value: boolean) => void,
) => {
  const [searchParams] = useSearchParams();
  const routeRoastBatchId = searchParams.get('roastBatchId')?.trim() ?? undefined;
  const routeBeanId = searchParams.get('beanId')?.trim() ?? undefined;
  const routeMode = searchParams.get('mode')?.trim();
  const resolvedRouteMode = resolveRouteMode(routeRoastBatchId, routeMode, routeBeanId);
  const isNewConversationNavigationRef = useRef(false);
  const [mode, setMode] = useState<RoastConversationMode>(resolvedRouteMode);
  const [beanId, setBeanId] = useState<string | undefined>(routeBeanId);
  const [roastBatchId, setRoastBatchId] = useState<string | undefined>(routeRoastBatchId);

  useEffect(() => {
    const isNewConversationRoute = !routeBeanId && !routeRoastBatchId && routeMode === 'batch_analysis';

    if (isNewConversationNavigationRef.current && isNewConversationRoute) {
      isNewConversationNavigationRef.current = false;
      return;
    }

    isNewConversationNavigationRef.current = false;

    const nextDisplayedBeanId = routeBeanId ?? routeBatch?.greenBeanId;

    setBeanId(routeBeanId);
    setRoastBatchId(routeRoastBatchId);
    setDisplayedBeanId(nextDisplayedBeanId);
    setMode(resolvedRouteMode);
    setIsNewConversation(false);
  }, [resolvedRouteMode, routeBatch?.greenBeanId, routeBeanId, routeMode, routeRoastBatchId, setDisplayedBeanId, setIsNewConversation]);

  return {
    beanId,
    isNewConversationNavigationRef,
    mode,
    roastBatchId,
    routeBeanId,
    routeRoastBatchId,
    setBeanId,
    setMode,
    setRoastBatchId,
  };
};
