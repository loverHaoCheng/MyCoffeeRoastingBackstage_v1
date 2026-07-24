import DeleteOutlined from '@ant-design/icons/DeleteOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Empty from 'antd/es/empty';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import { useState } from 'react';

import { AppDrawer } from '@/shared/components/AppDrawer';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import { useArchiveRoastingMachine, useCreateRoastingMachine, useRoasterModels, useRoastingMachines } from '../hooks';
import type { RoastingMachine } from '../types';
import { RoasterModelSubmission } from './RoasterModelSubmission';

import styles from './RoastingMachineManager.module.css';

interface RoastingMachineManagerProps {
  inSettings?: boolean;
}

export function RoastingMachineManager({ inSettings = false }: RoastingMachineManagerProps) {
  const { message, modal } = App.useApp();
  const [open, setOpen] = useState(false);
  const [modelId, setModelId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const models = useRoasterModels();
  const machines = useRoastingMachines();
  const createMachine = useCreateRoastingMachine();
  const archiveMachine = useArchiveRoastingMachine();
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

  const confirmArchive = (machine: RoastingMachine) => {
    modal.confirm({
      cancelText: '取消',
      centered: true,
      content: `删除后，这台烘焙机会从可选列表中隐藏；已创建的历史计划和记录仍会保留原有关联信息。确认删除“${machine.displayName}”吗？`,
      okText: '删除',
      okType: 'danger',
      onOk: async () => {
        try {
          await archiveMachine.mutateAsync(machine.id);
          void message.success('烘焙机已删除。');
        } catch (error) {
          void message.error(getUserFacingErrorMessage(error, '烘焙机删除失败，请稍后重试。'));
        }
      },
      title: '删除已关联烘焙机',
    });
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
              <div className={styles.machineInfo}>
                <strong>{machine.displayName}</strong>
                <span>{machine.modelKey}</span>
              </div>
              <Button
                aria-label={`删除${machine.displayName}`}
                className={styles.deleteButton}
                danger
                icon={<DeleteOutlined />}
                loading={archiveMachine.isPending}
                onClick={() => { confirmArchive(machine); }}
                shape="circle"
                type="text"
              />
            </li>
          ))}
        </ul>
      ) : (
        <Empty className={styles.empty} description="尚未关联烘焙机" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}

      <AppDrawer
        className={styles.drawer}
        height="76dvh"
        onClose={() => { setOpen(false); }}
        open={open}
        placement="bottom"
        title="添加烘焙机"
      >
        <div className={styles.form}>
          <section className={styles.formSection}>
            <header className={styles.sectionHeader}>
              <h3>关联已有机型</h3>
              <p>选择已审核或自己提交的机型模板，再给这台实体机器起一个便于识别的名称。</p>
            </header>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
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
              <label className={styles.field}>
                <span>我的机器名称</span>
                <Input
                  onChange={(event) => { setDisplayName(event.target.value); }}
                  placeholder="例如：店内 Tank200D"
                  value={displayName}
                />
              </label>
            </div>
          </section>
          <DrawerActionBar compact>
            <Button onClick={() => { setOpen(false); }}>取消</Button>
            <Button
              disabled={!selectedModel || !displayName.trim()}
              loading={createMachine.isPending}
              onClick={() => { void submit(); }}
              type="primary"
            >
              关联烘焙机
            </Button>
          </DrawerActionBar>
        </div>
      </AppDrawer>
    </section>
  );
}
