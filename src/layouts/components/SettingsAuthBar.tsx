import EditOutlined from '@ant-design/icons/EditOutlined';
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Input from 'antd/es/input';
import Typography from 'antd/es/typography';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { FieldEditorDrawer } from '@/shared/components/FieldEditorDrawer';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './SettingsAuthBar.module.css';

interface SettingsAuthBarProps {
  isDesktop: boolean;
}

export function SettingsAuthBar({ isDesktop }: SettingsAuthBarProps) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logout, updateProfileName, user } = useAuthStore();
  const [isNicknameDrawerOpen, setIsNicknameDrawerOpen] = useState(false);
  const [nicknameDraft, setNicknameDraft] = useState('');

  useEffect(() => {
    if (!isNicknameDrawerOpen) {
      return;
    }

    setNicknameDraft(user?.name ?? '');
  }, [isNicknameDrawerOpen, user?.name]);

  const nicknameDisplayValue = user?.name?.trim() ?? '';
  const authDisplaySeed = nicknameDisplayValue || (user?.email ?? 'U');

  const handleOpenNicknameDrawer = () => {
    if (!user) {
      return;
    }

    setNicknameDraft(user.name ?? '');
    setIsNicknameDrawerOpen(true);
  };

  const handleSaveNickname = async () => {
    if (!user) {
      setIsNicknameDrawerOpen(false);
      return;
    }

    const normalizedName = nicknameDraft.trim();

    if (normalizedName.length > 40) {
      void message.error('昵称不能超过 40 个字符。');
      return;
    }

    if (normalizedName === (user.name?.trim() ?? '')) {
      setIsNicknameDrawerOpen(false);
      return;
    }

    try {
      await updateProfileName(normalizedName);
      setIsNicknameDrawerOpen(false);
      void message.success(normalizedName ? '昵称已保存。' : '昵称已清空。');
    } catch (error) {
      if (typeof message.error === 'function') {
        void message.error(getUserFacingErrorMessage(error, '昵称保存失败，请检查网络或稍后重试。'));
      }
    }
  };

  const handleLogout = () => {
    void (async () => {
      await logout();
      queryClient.clear();
      void message.success('已退出登录');
      void navigate('/login', { replace: true });
    })();
  };

  return (
    <>
      <div className={styles.authBar} data-settings-auth-bar={isDesktop ? 'true' : undefined}>
        <div className={styles.authIdentity}>
          <div className={styles.authAvatar}>
            {authDisplaySeed.slice(0, 1).toUpperCase()}
          </div>
          <div className={styles.authMeta}>
            <button
              className={styles.authNicknameButton}
              onClick={handleOpenNicknameDrawer}
              title={nicknameDisplayValue || '设置昵称'}
              type="button"
            >
              <span className={styles.authNicknameText}>{nicknameDisplayValue || '设置昵称'}</span>
              <EditOutlined aria-hidden="true" className={styles.authNicknameEditIcon} />
            </button>
            <Typography.Text className={styles.authEmail} ellipsis>
              {user?.email ?? '未登录'}
            </Typography.Text>
          </div>
        </div>
        <Button className={styles.logoutButton} icon={<LogoutOutlined />} onClick={handleLogout} type="text">
          退出登录
        </Button>
      </div>
      <FieldEditorDrawer
        height="42dvh"
        onClose={() => {
          setIsNicknameDrawerOpen(false);
        }}
        onSubmit={handleSaveNickname}
        open={isNicknameDrawerOpen}
        submitLabel="保存昵称"
        title="修改昵称"
      >
        <label className={styles.authDrawerField}>
          <span className={styles.authDrawerLabel}>昵称</span>
          <Input
            autoFocus
            maxLength={40}
            onChange={(event) => {
              setNicknameDraft(event.target.value);
            }}
            placeholder="请输入昵称，留空则不显示"
            value={nicknameDraft}
          />
        </label>
      </FieldEditorDrawer>
    </>
  );
}
