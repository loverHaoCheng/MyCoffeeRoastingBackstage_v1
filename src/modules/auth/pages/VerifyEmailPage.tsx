import CheckCircleFilled from '@ant-design/icons/CheckCircleFilled';
import CloseCircleOutlined from '@ant-design/icons/CloseCircleOutlined';
import Button from 'antd/es/button';
import Spin from 'antd/es/spin';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { AuthPageShell } from '@/modules/auth/components/AuthPageShell';
import { pocketBaseAuthService } from '@/modules/auth/services/pocketBaseAuth.service';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import styles from './AuthPage.module.css';

type VerificationState = 'error' | 'loading' | 'success';

interface VerificationStatus {
  message: string;
  state: VerificationState;
}

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token')?.trim() ?? '';
  const requestedTokenRef = useRef<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>(() => {
    if (token) {
      return {
        message: '正在确认你的邮箱，请稍候。',
        state: 'loading',
      };
    }

    return {
      message: '验证链接无效或已过期，请返回登录页重新发送验证邮件。',
      state: 'error',
    };
  });

  useEffect(() => {
    if (!token || requestedTokenRef.current === token) {
      return;
    }

    requestedTokenRef.current = token;
    let isCurrentRequest = true;

    void pocketBaseAuthService
      .confirmVerification(token)
      .then((result) => {
        if (!isCurrentRequest) {
          return;
        }

        setStatus({
          message: result.message,
          state: 'success',
        });
      })
      .catch((error: unknown) => {
        if (!isCurrentRequest) {
          return;
        }

        setStatus({
          message: getUserFacingErrorMessage(error, '邮箱验证失败，请稍后重试。'),
          state: 'error',
        });
      });

    return () => {
      isCurrentRequest = false;
    };
  }, [token]);

  return (
    <AuthPageShell
      brandTitle="EasyBake"
      description=""
      eyebrow=""
      heroHidden
      shellClassName={styles.shellLogin}
      title="邮箱验证"
    >
      <div aria-live="polite" className={styles.verificationState}>
        {status.state === 'loading' ? <Spin size="large" /> : null}
        {status.state === 'success' ? <CheckCircleFilled className={styles.verificationSuccessIcon} /> : null}
        {status.state === 'error' ? <CloseCircleOutlined className={styles.verificationErrorIcon} /> : null}
        <h1>邮箱验证</h1>
        <p>{status.message}</p>
        {status.state !== 'loading' ? (
          <Button
            block
            onClick={() => {
              void navigate('/login', { replace: true });
            }}
            type="primary"
          >
            前往登录
          </Button>
        ) : null}
      </div>
    </AuthPageShell>
  );
}
