import Checkbox from 'antd/es/checkbox';
import Form from 'antd/es/form';
import { Link } from 'react-router-dom';

import styles from '../pages/AuthPage.module.css';

interface AgreementCheckboxProps {
  name?: string;
}

export function AgreementCheckbox({ name = 'agreementAccepted' }: AgreementCheckboxProps) {
  return (
    <Form.Item
      name={name}
      valuePropName="checked"
      rules={[
        {
          validator: (_, value: boolean | undefined) => {
            if (value === true) {
              return Promise.resolve();
            }

            return Promise.reject(new Error('请先阅读并同意用户协议和隐私政策'));
          },
        },
      ]}
    >
      <Checkbox>
        我已阅读并同意
        <Link className={styles.policyLink} to="/terms" target="_blank" rel="noreferrer">
          《用户协议》
        </Link>
        和
        <Link className={styles.policyLink} to="/privacy" target="_blank" rel="noreferrer">
          《隐私政策》
        </Link>
      </Checkbox>
    </Form.Item>
  );
}
