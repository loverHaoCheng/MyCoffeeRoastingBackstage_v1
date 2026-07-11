import LockOutlined from '@ant-design/icons/LockOutlined';
import MailOutlined from '@ant-design/icons/MailOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Space from 'antd/es/space';
import { Link, useNavigate } from 'react-router-dom';

import { AuthPageShell } from '@/modules/auth/components/AuthPageShell';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './AuthPage.module.css';

interface ForgotPasswordFormValues {
  email: string;
}

export function ForgotPasswordPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { requestPasswordReset } = useAuth();
  const [form] = Form.useForm<ForgotPasswordFormValues>();

  const handleFinish = async (values: ForgotPasswordFormValues) => {
    try {
      const result = await requestPasswordReset(values.email);
      void message.success(result.message);

      const nextSearchParams = new URLSearchParams({
        email: values.email.trim(),
        passwordReset: 'requested',
      });

      void navigate(`/login?${nextSearchParams.toString()}`, { replace: true });
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '重置密码邮件发送失败，请稍后重试。'));
    }
  };

  return (
    <AuthPageShell
      actions={
        <Space className={styles.actions} size={8}>
          <span>想起密码了？</span>
          <Link to="/login">返回登录</Link>
        </Space>
      }
      brandTitle="EasyBake"
      heroHidden
      description="输入注册邮箱后，我们会向你的邮箱发送密码重置邮件。"
      eyebrow="PocketBase Auth"
      shellClassName={styles.shellLogin}
      title="找回密码"
    >
      <Form<ForgotPasswordFormValues>
        autoComplete="on"
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void handleFinish(values);
        }}
        requiredMark={false}
        size="large"
      >
        <Form.Item<ForgotPasswordFormValues>
          label="邮箱"
          name="email"
          rules={[
            { required: true, message: '请输入邮箱' },
            { type: 'email', message: '请输入有效邮箱' },
          ]}
        >
          <Input prefix={<MailOutlined />} placeholder="name@example.com" />
        </Form.Item>

        <Button block htmlType="submit" icon={<LockOutlined />} type="primary">
          发送重置邮件
        </Button>
      </Form>
    </AuthPageShell>
  );
}
