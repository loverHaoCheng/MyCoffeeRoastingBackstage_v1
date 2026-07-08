export const beanFlavorTagMaxCount = 8;
export const beanFlavorTagMaxLength = 12;
export const beanFlavorTagTokenSeparators = [',', '，'];

const normalizeFlavorTag = (value: string): string => {
  return value.trim();
};

export const normalizeFlavorTags = (
  value: null | readonly string[] | undefined,
): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const nextTags: string[] = [];
  const seenTags = new Set<string>();

  value.forEach((rawTag) => {
    if (typeof rawTag !== 'string') {
      return;
    }

    rawTag
      .split(/[，,]/)
      .map(normalizeFlavorTag)
      .filter((tag) => tag.length > 0)
      .forEach((tag) => {
        if (seenTags.has(tag)) {
          return;
        }

        seenTags.add(tag);
        nextTags.push(tag);
      });
  });

  return nextTags;
};

export const parseFlavorTags = (value: null | string | undefined): string[] => {
  const normalizedValue = value?.trim() ?? '';

  if (normalizedValue.length === 0) {
    return [];
  }

  return normalizeFlavorTags(normalizedValue.split(/[，,]/));
};

export const serializeFlavorTags = (
  value: null | readonly string[] | undefined,
): null | string => {
  const normalizedTags = normalizeFlavorTags(value);

  return normalizedTags.length > 0 ? normalizedTags.join(',') : null;
};
