import LockOutlined from '@ant-design/icons/LockOutlined';
import MailOutlined from '@ant-design/icons/MailOutlined';
import UserAddOutlined from '@ant-design/icons/UserAddOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Space from 'antd/es/space';
import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { AgreementCheckbox } from '@/modules/auth/components/AgreementCheckbox';
import { AuthPageShell } from '@/modules/auth/components/AuthPageShell';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './AuthPage.module.css';

interface RegisterFormValues {
  agreementAccepted: boolean;
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
      const result = await register(values);

      if (result.verificationEmailSent) {
        void message.success(result.message);
      } else {
        void message.warning(result.message);
      }

      const nextSearchParams = new URLSearchParams({
        email: values.email.trim(),
        verification: result.verificationEmailSent ? 'sent' : 'failed',
      });

      void navigate(`/login?${nextSearchParams.toString()}`, { replace: true });
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
      brandTitle="EasyBake"
      heroHidden
      description="创建账号后，我们会先向你的邮箱发送验证邮件。完成验证后，才能登录并使用系统。"
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
              validator: (_, value) => {
                if (!value || getFieldValue('password') === value) {
                  return Promise.resolve();
                }

                return Promise.reject(new Error('两次输入的密码不一致'));
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请再次输入密码" />
        </Form.Item>

        <AgreementCheckbox />

        <Button block htmlType="submit" icon={<UserAddOutlined />} type="primary">
          注册
        </Button>
      </Form>
    </AuthPageShell>
  );
}
