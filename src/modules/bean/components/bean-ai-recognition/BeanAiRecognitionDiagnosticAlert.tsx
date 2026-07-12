import Alert from 'antd/es/alert';

import type { AiGatewayDiagnostic } from './beanAiRecognitionPlaceholder.utils';
import styles from '../BeanAiRecognitionPlaceholder.module.css';

interface BeanAiRecognitionDiagnosticAlertProps {
  gatewayDiagnostic: AiGatewayDiagnostic;
}

export function BeanAiRecognitionDiagnosticAlert({
  gatewayDiagnostic,
}: BeanAiRecognitionDiagnosticAlertProps) {
  const diagnosticDescription = (
    <dl className={styles.diagnosticGrid}>
      <div>
        <dt>触发来源</dt>
        <dd>{gatewayDiagnostic.sourceText}</dd>
      </div>
      <div>
        <dt>页面地址</dt>
        <dd>{gatewayDiagnostic.pageUrl}</dd>
      </div>
      <div>
        <dt>健康检查</dt>
        <dd>
          <a href={gatewayDiagnostic.healthUrl} rel="noreferrer" target="_blank">
            {gatewayDiagnostic.healthUrl}
          </a>
        </dd>
      </div>
      <div>
        <dt>健康检查实测</dt>
        <dd>{gatewayDiagnostic.healthStatusText}</dd>
      </div>
      <div>
        <dt>识别接口</dt>
        <dd>{gatewayDiagnostic.recognitionUrl}</dd>
      </div>
      <div>
        <dt>结果</dt>
        <dd>{gatewayDiagnostic.message}</dd>
      </div>
    </dl>
  );

  return (
    <Alert
      className={styles.diagnosticAlert}
      description={diagnosticDescription}
      message={gatewayDiagnostic.status === 'success' ? '服务检测通过' : '服务检测失败'}
      showIcon
      type={gatewayDiagnostic.status === 'success' ? 'success' : 'error'}
    />
  );
}
