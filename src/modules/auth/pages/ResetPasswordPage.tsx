import CheckCircleFilled from '@ant-design/icons/CheckCircleFilled';
import CloseCircleOutlined from '@ant-design/icons/CloseCircleOutlined';
import LockOutlined from '@ant-design/icons/LockOutlined';
import Button from 'antd/es/button';
import Form from 'antd/es/form';
import Input from '@/shared/components/ui/input';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthPageShell } from '@/modules/auth/components/AuthPageShell';
import { pocketBaseAuthService } from '@/modules/auth/services/pocketBaseAuth.service';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './AuthPage.module.css';

interface ResetPasswordFormValues {
  password: string;
  passwordConfirm: string;
}

interface ResetPasswordResult {
  message: string;
  state: 'error' | 'form' | 'success';
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const [form] = Form.useForm<ResetPasswordFormValues>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ResetPasswordResult>(() => (
    token
      ? { message: '', state: 'form' }
      : { message: '重置链接无效或已过期，请重新发起找回密码。', state: 'error' }
  ));

  const handleFinish = async (values: ResetPasswordFormValues) => {
    if (!token) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await pocketBaseAuthService.confirmPasswordReset(
        token,
        values.password,
        values.passwordConfirm,
      );
      setResult({
        message: response.message,
        state: 'success',
      });
    } catch (error) {
      setResult({
        message: getUserFacingErrorMessage(error, '密码重置失败，请稍后重试。'),
        state: 'error',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (result.state !== 'form') {
    return (
      <AuthPageShell
        brandTitle="EasyBake"
        description=""
        eyebrow=""
        heroHidden
        shellClassName={styles.shellLogin}
        title="重置密码"
      >
        <div aria-live="polite" className={styles.verificationState}>
          {result.state === 'success' ? <CheckCircleFilled className={styles.verificationSuccessIcon} /> : null}
          {result.state === 'error' ? <CloseCircleOutlined className={styles.verificationErrorIcon} /> : null}
          <h1>{result.state === 'success' ? '密码重置成功' : '无法重置密码'}</h1>
          <p>{result.message}</p>
          <Button
            block
            onClick={() => {
              void navigate(result.state === 'success' ? '/login' : '/forgot-password', { replace: true });
            }}
            type="primary"
          >
            {result.state === 'success' ? '前往登录' : '重新发起找回密码'}
          </Button>
        </div>
      </AuthPageShell>
    );
  }

  return (
    <AuthPageShell
      brandTitle="EasyBake"
      description="请输入至少 8 位的新密码。密码重置成功后，原密码将立即失效。"
      eyebrow="PocketBase Auth"
      shellClassName={styles.shellLogin}
      title="重置密码"
    >
      <Form<ResetPasswordFormValues>
        autoComplete="new-password"
        form={form}
        layout="vertical"
        onFinish={(values) => {
          void handleFinish(values);
        }}
        requiredMark={false}
        size="large"
      >
        <Form.Item<ResetPasswordFormValues>
          label="新密码"
          name="password"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少 8 位' },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} placeholder="请输入新密码" />
        </Form.Item>

        <Form.Item<ResetPasswordFormValues>
          dependencies={['password']}
          label="确认新密码"
          name="passwordConfirm"
          rules={[
            { required: true, message: '请再次输入新密码' },
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
          <Input.Password prefix={<LockOutlined />} placeholder="请再次输入新密码" />
        </Form.Item>

        <Button block htmlType="submit" loading={isSubmitting} type="primary">
          保存新密码
        </Button>
      </Form>
    </AuthPageShell>
  );
}
