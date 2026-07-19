"use client";

import { ChevronDown, X } from 'lucide-react';
import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useId,
  useMemo,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';

import { cn } from '@/shared/utils/cn';

type SelectPrimitiveValue = number | string;

interface SelectOption<T extends SelectPrimitiveValue = string> {
  disabled?: boolean;
  label: ReactNode;
  value: T | null;
}

interface SelectOptionGroup<T extends SelectPrimitiveValue = string> {
  items: SelectOption<T>[];
  label?: ReactNode;
}

interface SelectContextValue {
  placeholder?: ReactNode;
}

const SelectContext = createContext<SelectContextValue | null>(null);

const useSelectContext = (): SelectContextValue => {
  return useContext(SelectContext) ?? {};
};

interface SelectProps<T extends SelectPrimitiveValue = string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'defaultValue' | 'onChange' | 'value'> {
  allowClear?: boolean;
  children?: ReactNode;
  className?: string;
  defaultValue?: T | null;
  items?: SelectOption<T>[];
  loading?: boolean;
  onChange?: (value: T | undefined) => void;
  options?: SelectOption<T>[];
  placeholder?: string;
  showSearch?: boolean;
  style?: CSSProperties;
  value?: T | null;
}

interface SelectTriggerProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

interface SelectContentProps {
  children?: ReactNode;
}

interface SelectGroupProps {
  children?: ReactNode;
}

interface SelectItemProps<T extends SelectPrimitiveValue = string> {
  children?: ReactNode;
  disabled?: boolean;
  value: T;
}

interface SelectLabelProps {
  children?: ReactNode;
}

interface SelectValueProps {
  placeholder?: ReactNode;
}

interface ExtractedTriggerConfig {
  className?: string;
  placeholder?: ReactNode;
}

interface ExtractedSelectDefinition<T extends SelectPrimitiveValue = string> {
  groups: SelectOptionGroup<T>[];
  placeholder?: ReactNode;
  triggerClassName?: string;
}

const EMPTY_SELECT_VALUE = '__app-select-empty__';

const serializeValue = (value: SelectPrimitiveValue) => `${typeof value}:${String(value)}`;

const normalizeOptionGroups = <T extends SelectPrimitiveValue>(
  options?: SelectOption<T>[],
): SelectOptionGroup<T>[] => {
  if (!options || options.length === 0) {
    return [];
  }

  return [{ items: options }];
};

export function SelectTrigger({ children }: SelectTriggerProps) {
  return <>{children}</>;
}

export function SelectContent({ children }: SelectContentProps) {
  return <>{children}</>;
}

export function SelectGroup({ children }: SelectGroupProps) {
  return <>{children}</>;
}

export function SelectItem<T extends SelectPrimitiveValue>({ children }: SelectItemProps<T>) {
  return <>{children}</>;
}

export function SelectLabel({ children }: SelectLabelProps) {
  return <>{children}</>;
}

export function SelectValue() {
  const { placeholder } = useSelectContext();

  return <>{placeholder ?? null}</>;
}

const extractSelectTrigger = (
  node: ReactNode,
): ExtractedTriggerConfig => {
  if (!isValidElement<SelectTriggerProps>(node) || node.type !== SelectTrigger) {
    return {};
  }

  const placeholder = Children.toArray(node.props.children)
    .map((child) => {
      if (!isValidElement<SelectValueProps>(child) || child.type !== SelectValue) {
        return undefined;
      }

      return child.props.placeholder;
    })
    .find((value) => value != null);

  return {
    className: node.props.className,
    placeholder,
  };
};

const extractSelectLabel = (node: ReactNode): ReactNode | undefined => {
  if (!isValidElement<SelectLabelProps>(node) || node.type !== SelectLabel) {
    return undefined;
  }

  return node.props.children;
};

const extractSelectItem = <T extends SelectPrimitiveValue>(
  node: ReactNode,
): SelectOption<T> | null => {
  if (!isValidElement<SelectItemProps<T>>(node) || node.type !== SelectItem) {
    return null;
  }

  return {
    disabled: node.props.disabled,
    label: node.props.children,
    value: node.props.value,
  };
};

const extractSelectGroup = <T extends SelectPrimitiveValue>(
  node: ReactNode,
): SelectOptionGroup<T> | null => {
  if (!isValidElement<SelectGroupProps>(node) || node.type !== SelectGroup) {
    return null;
  }

  const children = Children.toArray(node.props.children);
  const label = children.map(extractSelectLabel).find((value) => value != null);
  const items = children
    .map((child) => extractSelectItem<T>(child))
    .filter((option): option is SelectOption<T> => option != null);

  return {
    items,
    label,
  };
};

const extractSelectDefinition = <T extends SelectPrimitiveValue>(
  children: ReactNode,
): ExtractedSelectDefinition<T> => {
  const definition: ExtractedSelectDefinition<T> = {
    groups: [],
  };

  for (const child of Children.toArray(children)) {
    const trigger = extractSelectTrigger(child);

    if (trigger.className) {
      definition.triggerClassName = trigger.className;
    }

    if (trigger.placeholder != null) {
      definition.placeholder = trigger.placeholder;
    }

    if (!isValidElement<SelectContentProps>(child) || child.type !== SelectContent) {
      continue;
    }

    for (const contentChild of Children.toArray(child.props.children)) {
      const group = extractSelectGroup<T>(contentChild);

      if (group) {
        definition.groups.push(group);
        continue;
      }

      const item = extractSelectItem<T>(contentChild);

      if (item) {
        definition.groups.push({ items: [item] });
        continue;
      }

      if (isValidElement<SelectValueProps>(contentChild) && contentChild.type === SelectValue) {
        definition.placeholder = contentChild.props.placeholder;
      }
    }
  }

  return definition;
};

const flattenSelectOptions = <T extends SelectPrimitiveValue>(
  groups: SelectOptionGroup<T>[],
): SelectOption<T>[] => {
  return groups.flatMap((group) => group.items);
};

const serializeOptionValue = (value: SelectPrimitiveValue | null): string => {
  return value == null ? EMPTY_SELECT_VALUE : serializeValue(value);
};

export function Select<T extends SelectPrimitiveValue = string>({
  allowClear = false,
  'aria-label': ariaLabel,
  children,
  className,
  defaultValue,
  disabled = false,
  items,
  loading = false,
  onChange,
  options,
  placeholder,
  showSearch,
  style,
  value,
  ...props
}: SelectProps<T>) {
  void showSearch;
  const selectId = useId();
  const childDefinition = useMemo(() => extractSelectDefinition<T>(children), [children]);
  const groupedOptions = useMemo<SelectOptionGroup<T>[]>(() => {
    if (options && options.length > 0) {
      return normalizeOptionGroups(options);
    }

    if (items && items.length > 0) {
      return normalizeOptionGroups(items);
    }

    return childDefinition.groups;
  }, [childDefinition.groups, items, options]);
  const flattenedOptions = useMemo(() => flattenSelectOptions(groupedOptions), [groupedOptions]);
  const resolvedPlaceholder = childDefinition.placeholder ?? placeholder;
  const normalizedValue = value ?? defaultValue ?? null;
  const selectedOption = flattenedOptions.find((option) => option.value === normalizedValue) ?? null;
  const displayLabel = loading ? '加载中...' : selectedOption?.label ?? resolvedPlaceholder ?? '请选择';
  const serializedValue = normalizedValue == null ? EMPTY_SELECT_VALUE : serializeValue(normalizedValue);
  const hasSelectableValue = normalizedValue != null;
  const effectiveDisabled = disabled || loading;

  return (
    <SelectContext.Provider value={{ placeholder: displayLabel }}>
        <div
          className={cn(
            'ant-select relative block w-full min-w-0 max-w-full overflow-hidden',
            'focus-within:[&_[data-ui-select-trigger="true"]]:border-[var(--app-emphasis-border-medium)]',
            'focus-within:[&_[data-ui-select-trigger="true"]]:ring-2',
            'focus-within:[&_[data-ui-select-trigger="true"]]:ring-[color-mix(in_srgb,var(--app-focus-ring)_25%,transparent)]',
            effectiveDisabled && 'opacity-60',
            className,
        )}
        style={style}
      >
        <select
          {...props}
          aria-label={ariaLabel}
          className="peer absolute inset-0 z-10 m-0 h-full w-full min-w-0 max-w-full cursor-pointer appearance-none rounded-2xl opacity-0 disabled:cursor-not-allowed"
          disabled={effectiveDisabled}
          id={selectId}
          onChange={(event) => {
            const nextValue = event.target.value;

            if (nextValue === EMPTY_SELECT_VALUE) {
              onChange?.(undefined);
              return;
            }

            const matchedOption = flattenedOptions.find((option) => serializeOptionValue(option.value) === nextValue);

            onChange?.((matchedOption?.value ?? undefined));
          }}
          value={serializedValue}
        >
          <option value={EMPTY_SELECT_VALUE}>{resolvedPlaceholder ?? '请选择'}</option>
          {groupedOptions.map((group, groupIndex) => {
            if (group.label == null) {
              return group.items.map((option) => (
                <option
                  disabled={option.disabled}
                  key={serializeOptionValue(option.value)}
                  value={serializeOptionValue(option.value)}
                >
                  {typeof option.label === 'string' ? option.label : String(option.value)}
                </option>
              ));
            }

            return (
              <optgroup key={`group-${String(groupIndex)}`} label={typeof group.label === 'string' ? group.label : `group-${String(groupIndex)}`}>
                {group.items.map((option) => (
                  <option
                    disabled={option.disabled}
                    key={serializeOptionValue(option.value)}
                    value={serializeOptionValue(option.value)}
                  >
                    {typeof option.label === 'string' ? option.label : String(option.value)}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>

        <div
          className={cn(
            'ant-select-selector flex min-h-11 w-full min-w-0 max-w-full items-center overflow-hidden rounded-2xl border border-[var(--app-border-soft)] bg-[var(--app-bg-elevated)] px-4 pr-11 text-[14px] text-[var(--app-text)] shadow-[inset_0_1px_0_var(--app-card-inset-highlight)] transition-colors duration-200',
            childDefinition.triggerClassName,
          )}
          data-ui-select-trigger="true"
        >
          <span
            className={cn(
              'min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap',
              selectedOption ? 'text-[var(--app-text)]' : 'text-[var(--app-text-tertiary)]',
            )}
          >
            {displayLabel}
          </span>
        </div>

        {allowClear && hasSelectableValue && !effectiveDisabled ? (
          <button
            aria-label="清空选择"
            className="absolute right-9 top-1/2 z-20 -translate-y-1/2 text-[var(--app-text-tertiary)] transition-colors hover:text-[var(--app-text)]"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onChange?.(undefined);
            }}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}

        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 z-20 h-4 w-4 -translate-y-1/2 text-[var(--app-text-tertiary)]"
        />
      </div>
    </SelectContext.Provider>
  );
}
