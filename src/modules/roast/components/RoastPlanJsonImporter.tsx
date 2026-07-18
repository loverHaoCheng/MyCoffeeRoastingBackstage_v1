import ImportOutlined from "@ant-design/icons/ImportOutlined";
import ReloadOutlined from "@ant-design/icons/ReloadOutlined";
import Button from "antd/es/button";
import Input from '@/shared/components/ui/input';
import { useEffect, useState } from 'react';

import { DrawerActionBar } from '@/shared/components/DrawerActionBar';

import { sampleRoastPlanJson } from '../services/roastPlanJson.service';

import styles from './RoastPlanJsonImporter.module.css';

const { TextArea } = Input;

interface RoastPlanJsonImporterProps {
  onCancel?: () => void;
  onImport: (jsonText: string) => Promise<void> | void;
  resetSignal?: number;
}

export function RoastPlanJsonImporter({ onCancel, onImport, resetSignal = 0 }: RoastPlanJsonImporterProps) {
  const [jsonText, setJsonText] = useState('');

  useEffect(() => {
    setJsonText('');
  }, [resetSignal]);

  const handleImport = () => {
    void onImport(jsonText);
  };

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <h2>根据 JSON 快速创建</h2>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            setJsonText(sampleRoastPlanJson);
          }}
        >
          填入模板
        </Button>
      </div>
      <TextArea
        aria-label="烘焙计划 JSON"
        autoSize={{ minRows: 8, maxRows: 18 }}
        className={styles.editor}
        onChange={(event) => {
          setJsonText(event.target.value);
        }}
        placeholder="可粘贴完整或部分烘焙计划 JSON，回填到表单后继续补充"
        spellCheck={false}
        value={jsonText}
      />
      <DrawerActionBar compact>
        {onCancel ? <Button onClick={onCancel}>取消</Button> : null}
        <Button icon={<ImportOutlined />} onClick={handleImport} type="primary">
          回填到表单
        </Button>
      </DrawerActionBar>
    </section>
  );
}
