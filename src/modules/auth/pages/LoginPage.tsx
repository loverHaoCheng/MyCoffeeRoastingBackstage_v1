import { LockOutlined, LoginOutlined, MailOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Space } from 'antd';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthPageShell } from '@/modules/auth/components/AuthPageShell';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './AuthPage.module.css';

interface LoginFormValues {
  email: string;
  password: string;
}

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();
  const [form] = Form.useForm<LoginFormValues>();

  useEffect(() => {
    if (isAuthenticated) {
      void navigate('/beans', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleFinish = async (values: LoginFormValues) => {
    try {
      await login(values);
      void message.success('登录成功');
      void navigate('/beans', { replace: true });
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '登录失败，请稍后重试。'));
    }
  };

  return (
    <AuthPageShell
      actions={
        <Space className={styles.actions} size={8}>
          <span>还没有账号？</span>
          <Link to="/register">去注册</Link>
        </Space>
      }
      heroHidden
      description="使用你的 PocketBase 账号登录后，只能查看当前用户自己的数据。"
      eyebrow="PocketBase Auth"
      shellClassName={styles.shellLogin}
      title="登录后台"
    >
      <Form<LoginFormValues>
        autoComplete="on"
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void handleFinish(values);
        }}
        requiredMark={false}
        size="large"
      >
        <Form.Item<LoginFormValues>
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效邮箱' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="name@example.com" />
        </Form.Item>

        <Form.Item<LoginFormValues>
          label="密码"
          name="password"
          rules={[{ required: true, message: '请输入密码' }]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
        </Form.Item>

        <Button block htmlType="submit" icon={<LoginOutlined />} type="primary">
          登录
        </Button>
      </Form>
    </AuthPageShell>
  );
}
