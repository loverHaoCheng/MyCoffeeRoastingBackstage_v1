const getEscapedAttributeValue = (value: string) => {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }

  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
};

export const scrollToField = (fieldPath: string) => {
  if (typeof document === 'undefined') {
    return;
  }

  window.requestAnimationFrame(() => {
    const container = document.querySelector<HTMLElement>(
      `[data-field-path="${getEscapedAttributeValue(fieldPath)}"]`,
    );

    if (!container) {
      return;
    }

    const target =
      container.querySelector<HTMLElement>(
        'input:not([type="hidden"]), textarea, .ant-select-selector, .ant-picker-input input, .ant-input-number-input, button',
      ) ?? container;

    container.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });

    if ('focus' in target && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  });
};
