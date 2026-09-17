import Modal from 'antd/es/modal';
import Button from 'antd/es/button';
import { useState } from 'react';

import { useAppUpdateNotice } from '@/app/hooks/useAppUpdateNotice';

export function AppUpdateModal() {
  const { notice, refreshToUpdate } = useAppUpdateNotice();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!notice) {
    return null;
  }

  const handleUpdate = () => {
    setIsUpdating(true);
    refreshToUpdate();
  };

  return (
    <Modal
      centered
      closable={false}
      footer={
        <Button onClick={handleUpdate} type="primary" block loading={isUpdating} disabled={isUpdating}>
          {isUpdating ? '正在更新...' : '立即刷新'}
        </Button>
      }
      maskClosable={false}
      mask={true}
      open={true}
      title={notice.type === 'available' ? '检测到新版本' : '应用已更新'}
      width={400}
      styles={{
        mask: {
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
        },
      }}
    >
      <p>{notice.message}</p>
    </Modal>
  );
}
