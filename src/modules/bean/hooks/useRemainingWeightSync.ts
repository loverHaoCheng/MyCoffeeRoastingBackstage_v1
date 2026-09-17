import { useEffect, useRef } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

import type { GreenBeanFormInput } from '../types/localGreenBean';

interface UseRemainingWeightSyncParams {
  currentPurchasedWeightGrams: number;
  currentRemainingWeightGrams: number;
  initialPurchasedWeight: number;
  setValue: UseFormSetValue<GreenBeanFormInput>;
}

export function useRemainingWeightSync({
  currentPurchasedWeightGrams,
  currentRemainingWeightGrams,
  initialPurchasedWeight,
  setValue,
}: UseRemainingWeightSyncParams): void {
  const lastPurchasedWeightRef = useRef(initialPurchasedWeight);

  useEffect(() => {
    const previousPurchasedWeight = lastPurchasedWeightRef.current;

    if (
      currentPurchasedWeightGrams !== previousPurchasedWeight &&
      currentRemainingWeightGrams === previousPurchasedWeight
    ) {
      setValue('remainingWeightGrams', currentPurchasedWeightGrams, { shouldDirty: true });
    }

    lastPurchasedWeightRef.current = currentPurchasedWeightGrams;
  }, [currentPurchasedWeightGrams, currentRemainingWeightGrams, setValue]);
}
