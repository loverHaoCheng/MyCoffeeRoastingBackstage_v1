import type { Bean } from '@/types/domain';

export const buildBeanMap = (beans: Bean[]): Map<string, Bean> => {
  return new Map(beans.map((bean) => [String(bean.id), bean]));
};

export const buildBeanNameMap = (beans: Bean[]): Map<string, Bean> => {
  return new Map(beans.map((bean) => [bean.name.trim(), bean]));
};
