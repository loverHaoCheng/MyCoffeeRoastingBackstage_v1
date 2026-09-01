import SaveOutlined from '@ant-design/icons/SaveOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';
import Button from 'antd/es/button';
import type { ReactNode, SyntheticEvent } from 'react';
import { useRef, useState } from 'react';

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
  const formRef = useRef<HTMLFormElement | null>(null);

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
      data-placement={placement}
      destroyOnHidden={destroyOnHidden}
      height={height}
      onClose={onClose}
      open={open}
      placement={placement}
      title={title}
      width={width}
      headerActions={
        <>
          <Button aria-label="取消" className={styles.headerCancelButton} icon={<CloseOutlined />} onClick={onClose} shape="circle" />
          <Button aria-label={submitLabel} className={styles.headerSubmitButton} icon={<CheckOutlined />} loading={submitting} onClick={() => { formRef.current?.requestSubmit(); }} shape="circle" />
        </>
      }
    >
      <form className={styles.form} ref={formRef} onSubmit={handleSubmit}>
        <div className={styles.inner}>
          <div className={styles.content}>{children}</div>
          <DrawerActionBar compact>
            <Button block onClick={onClose} type="default">
              取消
            </Button>
            <Button block htmlType="submit" icon={<SaveOutlined />} loading={submitting} type="primary">
              {submitting && loadingLabel ? loadingLabel : submitLabel}
            </Button>
          </DrawerActionBar>
        </div>
      </form>
    </AppDrawer>
  );
}
