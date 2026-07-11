import LockOutlined from '@ant-design/icons/LockOutlined';
import LoginOutlined from '@ant-design/icons/LoginOutlined';
import MailOutlined from '@ant-design/icons/MailOutlined';
import SendOutlined from '@ant-design/icons/SendOutlined';
import Alert from 'antd/es/alert';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Input from 'antd/es/input';
import Space from 'antd/es/space';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { AgreementCheckbox } from '@/modules/auth/components/AgreementCheckbox';
import { AuthPageShell } from '@/modules/auth/components/AuthPageShell';
import { useAuth } from '@/modules/auth/hooks/useAuth';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './AuthPage.module.css';

interface LoginFormValues {
  agreementAccepted: boolean;
  email: string;
  password: string;
}

const isFormValidationError = (error: unknown): boolean => {
  return typeof error === 'object' && error != null && 'errorFields' in error;
};

export function LoginPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated, login, requestVerification } = useAuth();
  const [form] = Form.useForm<LoginFormValues>();
  const verificationState = searchParams.get('verification');
  const passwordResetRequested = searchParams.get('passwordReset') === 'requested';
  const pendingEmail = searchParams.get('email')?.trim() ?? '';
  const [isResendingVerification, setIsResendingVerification] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      void navigate('/beans', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (pendingEmail.length > 0) {
      form.setFieldValue('email', pendingEmail);
    }
  }, [form, pendingEmail]);

  const handleFinish = async (values: LoginFormValues) => {
    try {
      await login(values);
      void message.success('登录成功');
      void navigate('/beans', { replace: true });
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '登录失败，请稍后重试。'));
    }
  };

  const handleResendVerification = async () => {
    try {
      const { email } = await form.validateFields(['email']);

      setIsResendingVerification(true);
      const result = await requestVerification(email);
      void message.success(result.message);
    } catch (error) {
      if (isFormValidationError(error)) {
        return;
      }

      void message.error(getUserFacingErrorMessage(error, '验证邮件发送失败，请稍后重试。'));
    } finally {
      setIsResendingVerification(false);
    }
  };

  const shouldShowVerificationNotice = verificationState === 'failed' || verificationState === 'sent';
  const verificationNoticeMessage =
    verificationState === 'failed'
      ? '账号已创建，但验证邮件尚未成功发出。'
      : '验证邮件已发送，请先完成邮箱验证。';
  const verificationNoticeDescription =
    verificationState === 'failed'
      ? '请先确认邮箱填写正确，再点击下方“重新发送验证邮件”。'
      : '完成验证后再返回这里登录。如果没有看到邮件，也可以直接重新发送。';

  return (
    <AuthPageShell
      actions={
        <Space className={styles.actions} size={8}>
          <span>还没有账号？</span>
          <Link to="/register">去注册</Link>
        </Space>
      }
      brandTitle="EasyBake"
      heroHidden
      description="使用你的 PocketBase 账号登录后，只能查看当前用户自己的数据。未完成邮箱验证的账号暂时不能进入系统。"
      eyebrow="PocketBase Auth"
      shellClassName={styles.shellLogin}
      title="登录后台"
    >
      {shouldShowVerificationNotice ? (
        <Alert
          className={styles.notice}
          description={verificationNoticeDescription}
          message={verificationNoticeMessage}
          showIcon
          type={verificationState === 'failed' ? 'warning' : 'success'}
        />
      ) : null}

      {passwordResetRequested ? (
        <Alert
          className={styles.notice}
          description="如果该邮箱已注册，重置密码邮件已经发出。请前往邮箱继续操作。"
          message="密码重置邮件已发送"
          showIcon
          type="info"
        />
      ) : null}

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

        <div className={styles.formAssist}>
          <Link className={styles.inlineLink} to="/forgot-password">
            忘记密码
          </Link>
        </div>

        <AgreementCheckbox />

        <Button block htmlType="submit" icon={<LoginOutlined />} type="primary">
          登录
        </Button>

        <Button
          block
          className={styles.secondaryButton}
          icon={<SendOutlined />}
          loading={isResendingVerification}
          onClick={() => {
            void handleResendVerification();
          }}
        >
          重新发送验证邮件
        </Button>
      </Form>
    </AuthPageShell>
  );
}
