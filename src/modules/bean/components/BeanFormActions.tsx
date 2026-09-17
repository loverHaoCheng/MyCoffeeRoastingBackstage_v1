import SaveOutlined from '@ant-design/icons/SaveOutlined';
import Button from 'antd/es/button';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';

interface Props {
  formId?: string;
  onCancel?: () => void;
  submitLabel: string;
}

export function BeanFormActions({ formId, onCancel, submitLabel }: Props) {
  return (
    <DrawerActionBar compact>
      {onCancel ? <Button block onClick={onCancel}>取消</Button> : null}
      <Button
        aria-label={submitLabel}
        block
        form={formId}
        htmlType="submit"
        icon={<SaveOutlined />}
        type="primary"
      >
        {submitLabel}
      </Button>
    </DrawerActionBar>
  );
}
