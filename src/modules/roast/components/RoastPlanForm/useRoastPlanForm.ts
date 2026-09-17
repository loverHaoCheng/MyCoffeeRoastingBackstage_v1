import { useCallback, useEffect, useMemo } from 'react';
import type { MessageInstance } from 'antd/es/message/interface';
import { type FieldPath, useFieldArray, useForm, useWatch } from 'react-hook-form';

import { useBeans } from '@/modules/bean/hooks/useBeans';
import { useRoastingMachines } from '@/modules/roast/hooks';
import { roastPlanJsonSchema } from '@/modules/roast/schemas/roastPlanJson.schema';
import { getRoasterControlCapabilities } from '@/modules/roast/utils/roasterControlCapabilities';
import type { RoastPlanJsonInput } from '../../types';
import { formatUnit } from './formatUtils';
import { GENERIC_BEAN_ID, GENERIC_BEAN_NAME } from './formConstants';

export const useRoastPlanForm = (
  initialValues: RoastPlanJsonInput,
  onSubmit: (input: RoastPlanJsonInput) => Promise<void> | void,
  resetOnSubmit: boolean,
  message: MessageInstance,
) => {
  const { data: beans = [], isLoading: beansLoading } = useBeans();
  const { data: roastingMachines = [], isLoading: roastingMachinesLoading } = useRoastingMachines();

  const beanOptions = useMemo(() => [
    { label: GENERIC_BEAN_NAME, value: GENERIC_BEAN_ID },
    ...beans.map((bean) => ({
      label: bean.name,
      value: String(bean.id),
    })),
  ], [beans]);

  const roastingMachineOptions = useMemo(() => roastingMachines.map((machine) => ({
    label: `${machine.displayName} · ${machine.modelKey}`,
    value: machine.id,
  })), [roastingMachines]);

  const { control, handleSubmit, reset, setFocus, setValue } = useForm<RoastPlanJsonInput>({
    defaultValues: initialValues,
  });

  const { append, fields, move, remove } = useFieldArray({
    control,
    name: 'steps',
  });

  const selectedRoasterMachineId = useWatch({
    control,
    name: 'roasterMachineId',
  });

  const selectedMachine = useMemo(
    () => roastingMachines.find((machine) => machine.id === selectedRoasterMachineId),
    [roastingMachines, selectedRoasterMachineId],
  );

  const adjustableControls = useMemo(
    () => getRoasterControlCapabilities(selectedMachine),
    [selectedMachine],
  );

  const showAirTemperature = adjustableControls.includes('airTemperature');
  const showAirDamper = adjustableControls.includes('airDamper');
  const showDrumSpeed = adjustableControls.includes('drumSpeed');
  const showFirePower = adjustableControls.includes('firePower');

  useEffect(() => {
    reset(initialValues);
  }, [initialValues, reset]);

  const submitForm = useCallback(async (values: RoastPlanJsonInput) => {
    if (values.beanId == null || String(values.beanId).trim().length === 0) {
      void message.warning('请选择生豆或"通用"后再保存烘焙计划。');
      window.requestAnimationFrame(() => {
        setFocus('beanId');
      });
      return;
    }

    const selectedBean = beans.find((bean) => String(bean.id) === String(values.beanId));
    const isGenericPlan = String(values.beanId) === GENERIC_BEAN_ID;
    const submitMachine = roastingMachines.find((machine) => machine.id === values.roasterMachineId);
    const submitControls = getRoasterControlCapabilities(submitMachine);
    const payload = {
      ...values,
      beanName: isGenericPlan ? GENERIC_BEAN_NAME : selectedBean?.name ?? values.beanName,
      steps: values.steps.map((step) => ({
        ...step,
        airDamper: showAirDamper ? formatUnit(step.airDamper ?? '', '%') : undefined,
        airTemperature: submitControls.includes('airTemperature') ? formatUnit(step.airTemperature, '℃') : '不可调',
        drumSpeed: submitControls.includes('drumSpeed') ? formatUnit(step.drumSpeed, 'r') : '不可调',
        firePower: submitControls.includes('firePower') ? formatUnit(step.firePower, '%') : '不可调',
        temperature: formatUnit(step.temperature, '℃'),
      })),
    };
    const validationResult = roastPlanJsonSchema.safeParse(payload);

    if (!validationResult.success) {
      void message.error(validationResult.error.issues.map((issue) => issue.message).join('；'));
      const firstFieldPath = validationResult.error.issues
        .map((issue) => issue.path.join('.') as FieldPath<RoastPlanJsonInput>)
        .find(Boolean);

      if (firstFieldPath) {
        window.requestAnimationFrame(() => {
          setFocus(firstFieldPath);
        });
      }
      return;
    }

    await onSubmit(validationResult.data);

    if (resetOnSubmit) {
      reset(initialValues);
    }
  }, [beans, initialValues, message, onSubmit, reset, resetOnSubmit, roastingMachines, setFocus, showAirDamper]);

  const handleAppendStep = useCallback(() => {
    append({
      airTemperature: showAirTemperature ? '-' : '不可调',
      airDamper: showAirDamper ? '' : undefined,
      drumSpeed: showDrumSpeed ? '' : '不可调',
      event: '',
      firePower: showFirePower ? '' : '不可调',
      operation: '',
      temperature: '-',
      time: '',
    });
  }, [append, showAirDamper, showAirTemperature, showDrumSpeed, showFirePower]);

  return {
    control,
    handleSubmit,
    setValue,
    fields,
    move,
    remove,
    beans,
    beansLoading,
    beanOptions,
    roastingMachines,
    roastingMachinesLoading,
    roastingMachineOptions,
    showAirTemperature,
    showAirDamper,
    showDrumSpeed,
    showFirePower,
    submitForm,
    handleAppendStep,
  };
};
