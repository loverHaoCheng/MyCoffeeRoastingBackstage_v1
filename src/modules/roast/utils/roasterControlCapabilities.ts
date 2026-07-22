import type { RoastingMachine } from '@/modules/roast/types';

export type RoasterControlKey = 'airTemperature' | 'drumSpeed' | 'firePower';

const allControls: RoasterControlKey[] = ['firePower', 'airTemperature', 'drumSpeed'];

const controlAliases: Record<RoasterControlKey, string[]> = {
  airTemperature: ['airtemperature', 'air_temperature', 'airtemp', 'windtemperature', '风温'],
  drumSpeed: ['drumspeed', 'drum_speed', 'rpm', 'rotation', '转速'],
  firePower: ['firepower', 'fire_power', 'gas', 'heat', 'power', '火力', '燃气'],
};

const normalizeText = (value: unknown): string => {
  return typeof value === 'string' ? value.trim().toLowerCase().replaceAll(/\s/g, '') : '';
};

const flattenControlText = (value: unknown): string => {
  if (Array.isArray(value)) {
    return value.map(flattenControlText).join(' ');
  }

  if (value != null && typeof value === 'object') {
    return Object.entries(value)
      .map(([key, item]) => `${key} ${flattenControlText(item)}`)
      .join(' ');
  }

  return normalizeText(value);
};

const hasControlAlias = (text: string, control: RoasterControlKey): boolean => {
  return controlAliases[control].some((alias) => text.includes(alias));
};

export const getRoasterControlCapabilities = (machine?: Pick<RoastingMachine, 'configuration' | 'displayName' | 'modelKey'> | null): RoasterControlKey[] => {
  if (!machine) {
    return allControls;
  }

  const configurationText = flattenControlText(machine.configuration);
  const configuredControls = allControls.filter((control) => hasControlAlias(configurationText, control));

  if (configuredControls.length > 0) {
    return configuredControls;
  }

  const machineText = `${normalizeText(machine.displayName)} ${normalizeText(machine.modelKey)}`;

  if (machineText.includes('tank200d')) {
    return ['firePower'];
  }

  return allControls;
};
