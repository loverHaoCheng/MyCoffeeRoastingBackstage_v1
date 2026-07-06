import { Button } from 'antd';
import type { ReactNode, SyntheticEvent } from 'react';
import { useState } from 'react';

import { AppDrawer } from './AppDrawer';
import { DrawerActionBar } from './DrawerActionBar';
import styles from './FieldEditorDrawer.module.css';

interface FieldEditorDrawerProps {
  children: ReactNode;
  destroyOnHidden?: boolean;
  height?: string;
  loadingLabel?: string;
  onClose: () => void;
  onSubmit: () => Promise<void> | void;
  open: boolean;
  placement?: 'bottom' | 'left' | 'right' | 'top';
  submitLabel: string;
  title: string;
  width?: number;
}

export function FieldEditorDrawer({
  children,
  destroyOnHidden = true,
  height,
  loadingLabel,
  onClose,
  onSubmit,
  open,
  placement = 'bottom',
  submitLabel,
  title,
  width,
}: FieldEditorDrawerProps) {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (submitting) {
      return;
    }

    setSubmitting(true);
    const runSubmit = async () => {
      try {
        await Promise.resolve(onSubmit());
      } finally {
        setSubmitting(false);
      }
    };

    void runSubmit();
  };

  return (
    <AppDrawer
      className={styles.drawer}
      destroyOnHidden={destroyOnHidden}
      height={height}
      onClose={onClose}
      open={open}
      placement={placement}
      title={title}
      width={width}
    >
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.content}>{children}</div>
        <DrawerActionBar compact>
          <Button block onClick={onClose} type="default">
            取消
          </Button>
          <Button block htmlType="submit" loading={submitting} type="primary">
            {submitting && loadingLabel ? loadingLabel : submitLabel}
          </Button>
        </DrawerActionBar>
      </form>
    </AppDrawer>
  );
}
