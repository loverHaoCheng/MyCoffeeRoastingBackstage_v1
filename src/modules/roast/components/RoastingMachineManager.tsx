import PlusOutlined from '@ant-design/icons/PlusOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Drawer from 'antd/es/drawer';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import { useState } from 'react';

import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import { useCreateRoastingMachine, useRoasterModels, useRoastingMachines } from '../hooks';
import { RoasterModelSubmission } from './RoasterModelSubmission';

import styles from './RoastingMachineManager.module.css';

interface RoastingMachineManagerProps {
  inSettings?: boolean;
}

export function RoastingMachineManager({ inSettings = false }: RoastingMachineManagerProps) {
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const models = useRoasterModels();
  const machines = useRoastingMachines();
  const createMachine = useCreateRoastingMachine();
  const selectedModel = models.data?.find((model) => model.id === modelId);

  const submit = async () => {
    if (!selectedModel || !displayName.trim()) {
      return;
    }

    try {
      await createMachine.mutateAsync({
        configuration: {},
        displayName: displayName.trim(),
        modelId: selectedModel.id,
        modelKey: `${selectedModel.brand} ${selectedModel.modelName}`.trim(),
      });
      setOpen(false);
      setModelId('');
      setDisplayName('');
      void message.success('烘焙机已创建。');
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '烘焙机创建失败，请稍后重试。'));
    }
  };

  return (
    <section
      aria-label="我的烘焙机"
      className={styles.section}
      data-settings={inSettings}
    >
      <header className={styles.header}>
        <div className={styles.summary}>
          {inSettings ? null : <h2>烘焙机</h2>}
          <span>{`${String(machines.data?.length ?? 0)} 台已关联`}</span>
        </div>
        <div className={styles.actions}>
          <RoasterModelSubmission />
          <Button icon={<PlusOutlined />} onClick={() => { setOpen(true); }} type="primary">
            添加烘焙机
          </Button>
        </div>
      </header>

      {machines.data?.length ? (
        <ul className={styles.machineList}>
          {machines.data.map((machine) => (
            <li key={machine.id}>
              <strong>{machine.displayName}</strong>
              <span>{machine.modelKey}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty className={styles.empty} description="尚未关联烘焙机" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}

      <Drawer
        className={styles.drawer}
        destroyOnHidden
        onClose={() => { setOpen(false); }}
        open={open}
        title="添加烘焙机"
      >
        <div className={styles.form}>
          <label>
            <span>机型模板</span>
            <Select
              loading={models.isLoading}
              onChange={(value) => { setModelId(value); }}
              options={(models.data ?? []).map((model) => ({
                label: `${model.brand} ${model.modelName}`,
                value: model.id,
              }))}
              placeholder="选择已审核或我提交的机型"
              value={modelId || undefined}
            />
          </label>
          <label>
            <span>我的机器名称</span>
            <Input
              onChange={(event) => { setDisplayName(event.target.value); }}
              placeholder="例如：店内 Tank200D"
              value={displayName}
            />
          </label>
          <Button
            block
            disabled={!selectedModel || !displayName.trim()}
            loading={createMachine.isPending}
            onClick={() => { void submit(); }}
            type="primary"
          >
            关联烘焙机
          </Button>
        </div>
      </Drawer>
    </section>
  );
}
