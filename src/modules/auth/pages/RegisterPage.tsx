import { LockOutlined, MailOutlined, UserAddOutlined } from '@ant-design/icons';
import { App, Button, Form, Input, Space } from 'antd';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AuthPageShell } from '@/modules/auth/components/AuthPageShell';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './AuthPage.module.css';

interface RegisterFormValues {
  email: string;
  password: string;
  passwordConfirm: string;
}

export function RegisterPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { isAuthenticated, register } = useAuth();
  const [form] = Form.useForm<RegisterFormValues>();

  useEffect(() => {
    if (isAuthenticated) {
      void navigate('/beans', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleFinish = async (values: RegisterFormValues) => {
    try {
      await register(values);
      void message.success('注册成功');
      void navigate('/beans', { replace: true });
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '注册失败，请稍后重试。'));
    }
  };

  return (
    <AuthPageShell
      actions={
        <Space className={styles.actions} size={8}>
          <span>已有账号？</span>
          <Link to="/login">去登录</Link>
        </Space>
      }
      heroHidden
      description="创建账号后，PocketBase 会自动把你的数据范围限制在当前用户名下。"
      eyebrow="PocketBase Auth"
      shellClassName={styles.shellLogin}
      title="创建账号"
    >
      <Form<RegisterFormValues>
        autoComplete="on"
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void handleFinish(values);
        }}
        requiredMark={false}
        size="large"
      >
        <Form.Item<RegisterFormValues>
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效邮箱' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="name@example.com" />
        </Form.Item>

        <Form.Item<RegisterFormValues>
          label="密码"
          name="password"
          rules={[
            { required: true, message: '请输入密码' },
            { min: 8, message: '密码至少 8 位' },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
        </Form.Item>

        <Form.Item<RegisterFormValues>
          dependencies={['password']}
          label="确认密码"
          name="passwordConfirm"
          rules={[
            { required: true, message: '请再次输入密码' },
            ({ getFieldValue }) => ({
              validator: async (_, value) => {
                if (!value || getFieldValue('password') === value) {
                  return;
                }

                throw new Error('两次输入的密码不一致');
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
        </Form.Item>

        <Button block htmlType="submit" icon={<UserAddOutlined />} type="primary">
          注册
        </Button>
      </Form>
    </AuthPageShell>
  );
}
