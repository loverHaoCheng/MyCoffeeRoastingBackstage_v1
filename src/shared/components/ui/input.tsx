import { Eye, EyeOff } from 'lucide-react';
import {
  type ChangeEvent,
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from 'react';

import { cn } from '@/shared/utils/cn';

type InputStatus = 'error' | 'warning';

interface SharedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'size'> {
  allowClear?: boolean;
  prefix?: ReactNode;
  status?: InputStatus;
  suffix?: ReactNode;
}

interface SharedPasswordInputProps extends Omit<SharedInputProps, 'type'> {
  defaultVisible?: boolean;
}

interface SharedTextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'prefix'> {
  autoSize?: boolean | { maxRows?: number; minRows?: number };
  status?: InputStatus;
}

const frameClassName = (status?: InputStatus, disabled?: boolean): string => {
  return cn(
    'flex min-h-11 w-full min-w-0 max-w-full items-center gap-3 overflow-hidden rounded-2xl border bg-[var(--app-bg-elevated)] px-4 text-[var(--app-text)] shadow-[inset_0_1px_0_var(--app-card-inset-highlight)] transition-colors duration-200',
    status === 'error'
      ? 'border-[color-mix(in_srgb,var(--ant-color-error,#dc2626)_70%,var(--app-border-soft))]'
      : 'border-[var(--app-border-soft)]',
    disabled && 'cursor-not-allowed opacity-60',
    !disabled && 'focus-within:border-[var(--app-emphasis-border-medium)] focus-within:ring-2 focus-within:ring-[var(--app-focus-ring)]/25',
  );
};

const inputElementClassName = cn(
  'h-11 w-full min-w-0 max-w-full border-0 bg-transparent px-0 text-[14px] leading-5 text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-tertiary)] disabled:cursor-not-allowed',
  '[&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-date-and-time-value]:text-left [&::-webkit-inner-spin-button]:appearance-none',
);

const textAreaElementClassName = cn(
  'min-h-[104px] w-full min-w-0 max-w-full resize-none border-0 bg-transparent px-0 py-3 text-[14px] leading-6 text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-tertiary)] disabled:cursor-not-allowed',
);

const inputAffixClassName = 'shrink-0 text-[var(--app-text-tertiary)]';

const BaseInput = forwardRef<HTMLInputElement, SharedInputProps>(
  ({ allowClear = false, className, disabled, onChange, prefix, status, suffix, type = 'text', value, ...props }, ref) => {
    const hasValue = typeof value === 'string' ? value.length > 0 : typeof value === 'number';

    return (
      <div className={cn(frameClassName(status, disabled), className)}>
        {prefix ? <span className={inputAffixClassName}>{prefix}</span> : null}
        <input
          {...props}
          className={inputElementClassName}
          disabled={disabled}
          onChange={onChange}
          ref={ref}
          type={type}
          value={value}
        />
        {allowClear && hasValue ? (
          <button
            aria-label="清空输入"
            className="shrink-0 text-[var(--app-text-tertiary)] transition-colors hover:text-[var(--app-text)] disabled:pointer-events-none"
            disabled={disabled}
            onClick={() => {
              onChange?.({
                target: { value: '' },
              } as ChangeEvent<HTMLInputElement>);
            }}
            type="button"
          >
            ×
          </button>
        ) : null}
        {suffix ? <span className={inputAffixClassName}>{suffix}</span> : null}
      </div>
    );
  },
);

BaseInput.displayName = 'Input';

const PasswordInput = forwardRef<HTMLInputElement, SharedPasswordInputProps>(
  ({ className, defaultVisible = false, disabled, prefix, status, suffix, ...props }, ref) => {
    const [visible, setVisible] = useState(defaultVisible);

    return (
      <div className={cn(frameClassName(status, disabled), className)}>
        {prefix ? <span className={inputAffixClassName}>{prefix}</span> : null}
        <input
          {...props}
          className={inputElementClassName}
          disabled={disabled}
          ref={ref}
          type={visible ? 'text' : 'password'}
        />
        {suffix ? <span className={inputAffixClassName}>{suffix}</span> : null}
        <button
          aria-label={visible ? '隐藏密码' : '显示密码'}
          className="shrink-0 text-[var(--app-text-tertiary)] transition-colors hover:text-[var(--app-text)] disabled:pointer-events-none"
          disabled={disabled}
          onClick={() => {
            setVisible((current) => !current);
          }}
          type="button"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);

PasswordInput.displayName = 'Input.Password';

const TextAreaInput = forwardRef<HTMLTextAreaElement, SharedTextAreaProps>(
  ({ autoSize, className, disabled, rows, status, ...props }, ref) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    const mergedRef = (node: HTMLTextAreaElement | null) => {
      innerRef.current = node;

      if (typeof ref === 'function') {
        ref(node);
        return;
      }

      if (ref) {
        ref.current = node;
      }
    };

    const resolvedRows = useMemo(() => {
      if (typeof autoSize === 'object') {
        return autoSize.minRows ?? rows ?? 3;
      }

      return rows ?? 3;
    }, [autoSize, rows]);

    useEffect(() => {
      const element = innerRef.current;

      if (!element || !autoSize) {
        return;
      }

      element.style.height = '0px';
      const nextHeight = element.scrollHeight;
      const minRows = typeof autoSize === 'object' ? autoSize.minRows ?? resolvedRows : resolvedRows;
      const maxRows = typeof autoSize === 'object' ? autoSize.maxRows : undefined;
      const lineHeight = Number.parseFloat(window.getComputedStyle(element).lineHeight || '24');
      const minHeight = lineHeight * minRows;
      const maxHeight = maxRows ? lineHeight * maxRows : Number.POSITIVE_INFINITY;

      element.style.height = `${String(Math.min(Math.max(nextHeight, minHeight), maxHeight))}px`;
    }, [autoSize, props.value, resolvedRows]);

    return (
      <div className={cn(frameClassName(status, disabled), 'items-start py-0', className)}>
        <textarea
          {...props}
          className={textAreaElementClassName}
          disabled={disabled}
          ref={mergedRef}
          rows={resolvedRows}
        />
      </div>
    );
  },
);

TextAreaInput.displayName = 'Input.TextArea';

type InputComponent = typeof BaseInput & {
  Password: typeof PasswordInput;
  TextArea: typeof TextAreaInput;
};

const Input = Object.assign(BaseInput, {
  Password: PasswordInput,
  TextArea: TextAreaInput,
}) as InputComponent;

export default Input;
