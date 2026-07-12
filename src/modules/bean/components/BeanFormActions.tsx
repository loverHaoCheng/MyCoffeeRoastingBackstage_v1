import SaveOutlined from '@ant-design/icons/SaveOutlined';
import Button from 'antd/es/button';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';

interface Props { onCancel?: () => void; submitLabel: string }

export function BeanFormActions({ onCancel, submitLabel }: Props) {
  return <DrawerActionBar compact>
    {onCancel ? <Button block onClick={onCancel}>取消</Button> : null}
    <Button block htmlType="submit" icon={<SaveOutlined />} type="primary">{submitLabel}</Button>
  </DrawerActionBar>;
}
