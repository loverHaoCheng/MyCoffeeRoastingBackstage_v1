import { useEffect, useState, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

import {
  Drawer,
  DrawerContent,
} from '@/shared/components/ui/drawer';
import { cn } from '@/shared/utils/cn';

import styles from './AppDrawer.module.css';

const APP_DRAWER_OPEN_ATTRIBUTE = 'data-app-drawer-open';
const DRAWER_HANDLE_HEIGHT_PX = 6;
const DRAWER_HANDLE_TOP_OFFSET_PX = 8;
const DRAWER_HANDLE_CONTENT_GAP_PX = 8;
const DRAWER_TRANSITION_DURATION_MS = 320;

let activeDrawerCount = 0;

const syncAppDrawerOpenAttribute = () => {
  if (typeof document === 'undefined') {
    return;
  }

  if (activeDrawerCount > 0) {
    document.documentElement.setAttribute(APP_DRAWER_OPEN_ATTRIBUTE, 'true');
    return;
  }

  document.documentElement.removeAttribute(APP_DRAWER_OPEN_ATTRIBUTE);
};

const registerOpenAppDrawer = () => {
  activeDrawerCount += 1;
  syncAppDrawerOpenAttribute();

  return () => {
    activeDrawerCount = Math.max(0, activeDrawerCount - 1);
    syncAppDrawerOpenAttribute();
  };
};

type DrawerPlacement = 'bottom' | 'left' | 'right' | 'top';

interface AppDrawerStyles {
  body?: CSSProperties;
  content?: CSSProperties;
  footer?: CSSProperties;
  header?: CSSProperties;
  mask?: CSSProperties;
  wrapper?: CSSProperties;
}

interface AppDrawerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'title'> {
  children?: ReactNode;
  closable?: boolean;
  destroyOnHidden?: boolean;
  getContainer?: false | HTMLElement | null | (() => HTMLElement | null);
  height?: number | string;
  onClose: () => void;
  open: boolean;
  placement?: DrawerPlacement;
  showSwipeHandle?: boolean;
  styles?: AppDrawerStyles;
  title?: ReactNode;
  width?: number | string;
}

export function AppDrawer({
  children,
  className,
  closable = true,
  destroyOnHidden = true,
  getContainer,
  height,
  onClose,
  open,
  placement = 'right',
  showSwipeHandle,
  styles: drawerStyles,
  title,
  width,
  ...props
}: AppDrawerProps) {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    return registerOpenAppDrawer();
  }, [open]);

  const [shouldRenderChildren, setShouldRenderChildren] = useState(open || !destroyOnHidden);
  const [lastRenderedChildren, setLastRenderedChildren] = useState<ReactNode>(children);

  useEffect(() => {
    if (open && children != null) {
      setLastRenderedChildren(children);
    }
  }, [children, open]);

  useEffect(() => {
    if (open || !destroyOnHidden) {
      setShouldRenderChildren(true);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShouldRenderChildren(false);
    }, DRAWER_TRANSITION_DURATION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [destroyOnHidden, open]);

  const resolvedShowSwipeHandle = showSwipeHandle ?? placement === 'bottom';
  const hasCustomTopPadding = drawerStyles?.body?.paddingTop != null;

  const wrapperStyle: CSSProperties = {
    ...(drawerStyles?.wrapper ?? {}),
  };
  const hasCustomBottomPadding = drawerStyles?.body?.paddingBottom != null;
  const bodyStyle: CSSProperties = {
    ...(drawerStyles?.body ?? {}),
    ...(placement === 'bottom'
      ? hasCustomBottomPadding
        ? null
        : {
            paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
          }
      : null),
    ...(resolvedShowSwipeHandle && (placement === 'bottom' || placement === 'top')
      ? hasCustomTopPadding
        ? null
        : {
            paddingTop: `${String(
              DRAWER_HANDLE_TOP_OFFSET_PX + DRAWER_HANDLE_HEIGHT_PX + DRAWER_HANDLE_CONTENT_GAP_PX,
            )}px`,
          }
      : null),
  };

  if (placement === 'bottom' || placement === 'top') {
    if (height != null) {
      wrapperStyle.height = typeof height === 'number' ? `${String(height)}px` : height;
    }
  } else if (width != null) {
    wrapperStyle.width = typeof width === 'number' ? `${String(width)}px` : width;
  }

  return (
    <Drawer
      bodyStyle={bodyStyle}
      getContainer={getContainer}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      open={open}
      placement={placement}
      showSwipeHandle={resolvedShowSwipeHandle}
    >
      <DrawerContent
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(styles.drawer, className)}
        contentStyle={drawerStyles?.content}
        footerStyle={drawerStyles?.footer}
        forceMount
        headerStyle={drawerStyles?.header}
        maskStyle={drawerStyles?.mask}
        wrapperStyle={wrapperStyle}
        {...props}
      >
        <div className="ant-drawer-body" style={bodyStyle}>
          {shouldRenderChildren ? (children ?? lastRenderedChildren ?? null) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
