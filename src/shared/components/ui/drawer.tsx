"use client";

import { X } from 'lucide-react';
import {
  cloneElement,
  createContext,
  useContext,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/shared/utils/cn';

type DrawerPlacement = 'bottom' | 'left' | 'right' | 'top';
type DrawerContainer = false | HTMLElement | null | (() => HTMLElement | null);

interface DrawerContextValue {
  bodyStyle?: CSSProperties;
  descriptionId: string;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  placement: DrawerPlacement;
  showSwipeHandle: boolean;
  titleId: string;
}

const DrawerContext = createContext<DrawerContextValue | null>(null);

const useDrawerContext = () => {
  const context = useContext(DrawerContext);

  if (!context) {
    throw new Error('Drawer components must be used within Drawer.');
  }

  return context;
};

const resolveContainer = (container?: DrawerContainer): HTMLElement | null => {
  if (container === false) {
    return null;
  }

  if (typeof container === 'function') {
    return container();
  }

  if (container instanceof HTMLElement) {
    return container;
  }

  if (typeof document === 'undefined') {
    return null;
  }

  return document.body;
};

const callAll =
  <T extends MouseEvent<HTMLElement>>(first?: (event: T) => void, second?: (event: T) => void) =>
  (event: T) => {
    first?.(event);
    second?.(event);
  };

interface DrawerProps {
  bodyStyle?: CSSProperties;
  children: ReactNode;
  getContainer?: DrawerContainer;
  onOpenChange?: (open: boolean) => void;
  open: boolean;
  placement?: DrawerPlacement;
  showSwipeHandle?: boolean;
}

export function Drawer({
  bodyStyle,
  children,
  getContainer,
  onOpenChange,
  open,
  placement = 'bottom',
  showSwipeHandle = false,
}: DrawerProps) {
  const titleId = useId();
  const descriptionId = useId();
  const container = resolveContainer(getContainer);

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onOpenChange, open]);

  const content = (
    <DrawerContext.Provider
      value={{
        bodyStyle,
        descriptionId,
        onOpenChange,
        open,
        placement,
        showSwipeHandle,
        titleId,
      }}
    >
      {children}
    </DrawerContext.Provider>
  );

  if (container == null) {
    return content;
  }

  return createPortal(content, container);
}

interface DrawerContentProps extends HTMLAttributes<HTMLDivElement> {
  contentStyle?: CSSProperties;
  forceMount?: boolean;
  footerStyle?: CSSProperties;
  headerStyle?: CSSProperties;
  maskStyle?: CSSProperties;
  wrapperStyle?: CSSProperties;
}

const placementWrapperClassNameMap: Record<DrawerPlacement, string> = {
  bottom: 'inset-x-0 bottom-0 w-full',
  left: 'left-0 top-0 h-full',
  right: 'right-0 top-0 h-full',
  top: 'inset-x-0 top-0 w-full',
};

const placementTransitionClassNameMap: Record<DrawerPlacement, string> = {
  bottom: 'data-[state=closed]:translate-y-full',
  left: 'data-[state=closed]:-translate-x-full',
  right: 'data-[state=closed]:translate-x-full',
  top: 'data-[state=closed]:-translate-y-full',
};

export function DrawerContent({
  children,
  className,
  contentStyle,
  forceMount = false,
  footerStyle,
  headerStyle,
  maskStyle,
  wrapperStyle,
  ...props
}: DrawerContentProps) {
  const { descriptionId, onOpenChange, open, placement, showSwipeHandle, titleId } = useDrawerContext();
  const showTopSwipeHandle = showSwipeHandle && (placement === 'bottom' || placement === 'top');
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartYRef = useRef(0);
  const dragStartTimestampRef = useRef(0);
  const dragLastYRef = useRef(0);
  const dragLastTimestampRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const isSwipeDismissEnabled = open && placement === 'bottom' && showTopSwipeHandle;

  useEffect(() => {
    if (!open) {
      dragPointerIdRef.current = null;
      setIsDragging(false);
      setDragOffset(0);
    }
  }, [open]);

  const stopDragging = useCallback(() => {
    dragPointerIdRef.current = null;
    setIsDragging(false);
  }, []);

  const handleSwipeRelease = useCallback(() => {
    const wrapperHeight = wrapperRef.current?.getBoundingClientRect().height ?? 0;
    const elapsed = Math.max(dragLastTimestampRef.current - dragStartTimestampRef.current, 1);
    const travelledDistance = Math.max(dragLastYRef.current - dragStartYRef.current, 0);
    const velocity = travelledDistance / elapsed;
    const shouldClose =
      travelledDistance > Math.min(Math.max(wrapperHeight * 0.22, 72), 148) ||
      velocity >= 0.55;

    stopDragging();

    if (shouldClose) {
      onOpenChange?.(false);
      return;
    }

    setDragOffset(0);
  }, [onOpenChange, stopDragging]);

  const handleSwipePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!isSwipeDismissEnabled) {
      return;
    }

    const pointerId = event.pointerId || 1;

    dragPointerIdRef.current = pointerId;
    dragStartYRef.current = event.clientY;
    dragStartTimestampRef.current = event.timeStamp;
    dragLastYRef.current = event.clientY;
    dragLastTimestampRef.current = event.timeStamp;
    setIsDragging(true);
    setDragOffset(0);
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(pointerId);
  }, [isSwipeDismissEnabled]);

  const handleSwipePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== (event.pointerId || 1)) {
      return;
    }

    const nextOffset = Math.max(event.clientY - dragStartYRef.current, 0);

    dragLastYRef.current = event.clientY;
    dragLastTimestampRef.current = event.timeStamp;
    event.preventDefault();
    setDragOffset(nextOffset);
  }, []);

  const handleSwipePointerUp = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointerId = event.pointerId || 1;

    if (dragPointerIdRef.current !== pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture?.(pointerId)) {
      event.currentTarget.releasePointerCapture?.(pointerId);
    }

    handleSwipeRelease();
  }, [handleSwipeRelease]);

  const handleSwipePointerCancel = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointerId = event.pointerId || 1;

    if (dragPointerIdRef.current !== pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture?.(pointerId)) {
      event.currentTarget.releasePointerCapture?.(pointerId);
    }

    stopDragging();
    setDragOffset(0);
  }, [stopDragging]);

  if (!open && !forceMount) {
    return null;
  }

  return (
    <div
      aria-hidden={!open}
      className={cn('ant-drawer fixed inset-0 z-[140]', !open && 'pointer-events-none')}
      data-open={open ? 'true' : 'false'}
      data-placement={placement}
      data-state={open ? 'open' : 'closed'}
    >
      <div
        className={cn(
          'ant-drawer-mask absolute inset-0 bg-[rgb(15_23_42_/_20%)] backdrop-blur-[1px] transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0',
        )}
        onClick={() => {
          onOpenChange?.(false);
        }}
        style={maskStyle}
      />

      <div
        className={cn(
          'ant-drawer-content-wrapper absolute overflow-hidden transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] [touch-action:pan-y]',
          isDragging && 'transition-none',
          placementWrapperClassNameMap[placement],
          placementTransitionClassNameMap[placement],
        )}
        data-placement={placement}
        data-swipe-dismissible={String(isSwipeDismissEnabled)}
        data-state={open ? 'open' : 'closed'}
        ref={wrapperRef}
        style={
          open && dragOffset > 0
            ? {
                ...wrapperStyle,
                transform: `translate3d(0, ${String(dragOffset)}px, 0)`,
              }
            : wrapperStyle
        }
      >
        <div
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className={cn(
            'ant-drawer-content relative flex h-full max-h-full flex-col overflow-hidden overscroll-contain bg-[var(--app-bg-elevated)] [touch-action:pan-y]',
            className,
          )}
          role="dialog"
          style={contentStyle}
          tabIndex={-1}
          {...props}
        >
          {showTopSwipeHandle ? (
            <div className="absolute inset-x-0 top-0 z-10 flex justify-center px-4 pt-2">
              <button
                aria-label="拖动关闭抽屉"
                className={cn(
                  'flex h-[22px] w-full max-w-16 cursor-grab items-start justify-center rounded-full border-0 bg-transparent p-0 text-[var(--app-text-tertiary)] outline-none [touch-action:none]',
                  isDragging && 'cursor-grabbing',
                )}
                onPointerCancel={handleSwipePointerCancel}
                onPointerDown={handleSwipePointerDown}
                onPointerMove={handleSwipePointerMove}
                onPointerUp={handleSwipePointerUp}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 h-1.5 w-11 rounded-full bg-[color-mix(in_srgb,var(--app-text-tertiary)_48%,transparent)]"
                />
              </button>
            </div>
          ) : null}

          <DrawerSurfaceStyleContext.Provider value={{ footerStyle, headerStyle }}>
            {children}
          </DrawerSurfaceStyleContext.Provider>
        </div>
      </div>
    </div>
  );
}

interface DrawerSurfaceStyleContextValue {
  footerStyle?: CSSProperties;
  headerStyle?: CSSProperties;
}

const DrawerSurfaceStyleContext = createContext<DrawerSurfaceStyleContextValue | null>(null);

const useDrawerSurfaceStyles = () => {
  return useContext(DrawerSurfaceStyleContext);
};

export function DrawerHeader({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const surfaceStyles = useDrawerSurfaceStyles();

  return (
    <div
      className={cn('ant-drawer-header flex flex-col gap-2', className)}
      style={{ ...surfaceStyles?.headerStyle, ...style }}
      {...props}
    />
  );
}

export function DrawerFooter({ className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  const surfaceStyles = useDrawerSurfaceStyles();

  return (
    <div
      className={cn('ant-drawer-footer flex flex-col gap-3', className)}
      style={{ ...surfaceStyles?.footerStyle, ...style }}
      {...props}
    />
  );
}

export function DrawerTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useDrawerContext();

  return <h2 className={cn('ant-drawer-title', className)} id={titleId} {...props} />;
}

export function DrawerDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useDrawerContext();

  return <p className={cn(className)} id={descriptionId} {...props} />;
}

interface DrawerTriggerLikeProps {
  children?: ReactNode;
  className?: string;
  render?: ReactElement<{
    className?: string;
    onClick?: (event: MouseEvent<HTMLElement>) => void;
  }>;
}

const renderInteractiveElement = (
  element:
    | ReactElement<{
        className?: string;
        onClick?: (event: MouseEvent<HTMLElement>) => void;
      }>
    | undefined,
  fallbackLabel: ReactNode,
  onClick: (event: MouseEvent<HTMLElement>) => void,
  className?: string,
) => {
  if (element) {
    return cloneElement(element, {
      className: cn(className, element.props.className),
      onClick: callAll(element.props.onClick, onClick),
    });
  }

  return (
    <button className={className} onClick={onClick} type="button">
      {fallbackLabel}
    </button>
  );
};

export function DrawerTrigger({ children, className, render }: DrawerTriggerLikeProps) {
  const { onOpenChange } = useDrawerContext();

  return renderInteractiveElement(
    render,
    children ?? 'Open',
    () => {
      onOpenChange?.(true);
    },
    className,
  );
}

export function DrawerClose({ children, className, render }: DrawerTriggerLikeProps) {
  const { onOpenChange } = useDrawerContext();

  return renderInteractiveElement(
    render,
    children ?? (
      <>
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </>
    ),
    () => {
      onOpenChange?.(false);
    },
    className,
  );
}
