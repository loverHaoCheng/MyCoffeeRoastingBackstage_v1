import UploadOutlined from '@ant-design/icons/UploadOutlined';
import App from 'antd/es/app';
import Button from 'antd/es/button';
import Input from 'antd/es/input';
import Select from 'antd/es/select';
import { useRef, useState } from 'react';

import { AppDrawer } from '@/shared/components/AppDrawer';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';
import { getUserFacingErrorMessage } from '@/shared/errors/errorMessage';

import { useCreateRoasterModel } from '../hooks';
import { roasterMachineService } from '../services/roasterMachine.service';
import type { RoasterModelRecognition } from '../types/roasterMachine';

import styles from './RoasterModelSubmission.module.css';

interface RoasterModelFormState {
  airflowControl: string;
  brand: string;
  capacityRangeGrams: string;
  controlCapabilities: string;
  coolingMethod: string;
  drumMaterial: string;
  drumSpeedControl: string;
  exhaustDiameter: string;
  heatControl: string;
  heatSource: string;
  modelName: string;
  notes: string;
  powerSpec: string;
  recommendedBatchGrams: string;
  roastChamber: string;
  roastType: RoasterModelRecognition['roastType'];
  temperatureProbe: string;
}

const defaultFormState: RoasterModelFormState = {
  airflowControl: '固定排风或随结构自然排风',
  brand: '',
  capacityRangeGrams: '100-250g',
  controlCapabilities: '火力',
  coolingMethod: '外置冷却或手动冷却',
  drumMaterial: '金属滚筒',
  drumSpeedControl: '不可调',
  exhaustDiameter: '',
  heatControl: '燃气火力百分比调节',
  heatSource: '燃气直火',
  modelName: '',
  notes: '参考 Tank200D：小容量全直火机器，计划建议优先围绕火力和入豆炉温展开。',
  powerSpec: '',
  recommendedBatchGrams: '200g',
  roastChamber: '全直火滚筒',
  roastType: 'direct_fire',
  temperatureProbe: '豆温探针、炉温显示',
};

const roastTypeOptions: { label: string; value: RoasterModelRecognition['roastType'] }[] = [
  { label: '直火', value: 'direct_fire' },
  { label: '半热风', value: 'semi_hot_air' },
  { label: '热风', value: 'hot_air' },
  { label: '其他', value: 'other' },
];

const readDataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => { resolve(typeof reader.result === 'string' ? reader.result : ''); };
  reader.onerror = () => { reject(new Error('参数图片读取失败。')); };
  reader.readAsDataURL(file);
});

const stringifySpecificationSummary = (value: Record<string, unknown>): string => {
  const entries = Object.entries(value)
    .map(([key, item]) => `${key}：${typeof item === 'string' || typeof item === 'number' ? String(item) : JSON.stringify(item)}`)
    .filter((entry) => entry.trim().length > 0);

  return entries.slice(0, 12).join('；');
};

const mergeRecognitionToForm = (
  current: RoasterModelFormState,
  recognized: RoasterModelRecognition,
): RoasterModelFormState => {
  const recognizedSummary = stringifySpecificationSummary(recognized.specifications);

  return {
    ...current,
    brand: recognized.brand || current.brand,
    modelName: recognized.modelName || current.modelName,
    notes: recognizedSummary
      ? `图片识别参数摘要：${recognizedSummary}\n${current.notes}`.trim()
      : current.notes,
    roastType: recognized.roastType,
  };
};

const toSpecifications = (form: RoasterModelFormState): Record<string, unknown> => ({
  airflow: {
    control: form.airflowControl.trim(),
    exhaustDiameter: form.exhaustDiameter.trim(),
  },
  capacity: {
    range: form.capacityRangeGrams.trim(),
    recommendedBatch: form.recommendedBatchGrams.trim(),
  },
  controlCapabilities: form.controlCapabilities
    .split(/[、,，/]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0),
  cooling: {
    method: form.coolingMethod.trim(),
  },
  drum: {
    material: form.drumMaterial.trim(),
    speedControl: form.drumSpeedControl.trim(),
  },
  heating: {
    control: form.heatControl.trim(),
    source: form.heatSource.trim(),
  },
  notes: form.notes.trim(),
  power: {
    spec: form.powerSpec.trim(),
  },
  roastChamber: form.roastChamber.trim(),
  temperature: {
    probe: form.temperatureProbe.trim(),
  },
});

const renderLabel = (label: string, required = false) => (
  <span className={styles.labelText}>
    {label}
    {required ? (
      <em aria-hidden="true" className={styles.requiredMark}>
        *
      </em>
    ) : null}
  </span>
);

export function RoasterModelSubmission() {
  const { message } = App.useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<RoasterModelFormState>(defaultFormState);
  const [recognizing, setRecognizing] = useState(false);
  const createModel = useCreateRoasterModel();

  const updateForm = <K extends keyof RoasterModelFormState>(key: K, value: RoasterModelFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const resetAndClose = () => {
    setOpen(false);
    setForm(defaultFormState);
  };

  const chooseImage = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    setRecognizing(true);
    try {
      const recognized = await roasterMachineService.recognizeModelImage(await readDataUrl(file));
      setForm((current) => mergeRecognitionToForm(current, recognized));
      void message.success('参数已识别并回填到表单，请继续核对。');
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '参数识别失败，请更换清晰图片后重试。'));
    } finally {
      setRecognizing(false);
    }
  };

  const submit = async () => {
    if (!form.brand.trim() || !form.modelName.trim()) {
      void message.warning('请填写品牌和型号。');
      return;
    }

    try {
      await createModel.mutateAsync({
        brand: form.brand.trim(),
        modelName: form.modelName.trim(),
        roastType: form.roastType,
        specifications: toSpecifications(form),
      });
      resetAndClose();
      void message.success('机型已提交审核，当前账号可以立即关联。');
    } catch (error) {
      void message.error(getUserFacingErrorMessage(error, '机型提交失败，请检查字段后重试。'));
    }
  };

  return (
    <>
      <Button onClick={() => { setOpen(true); }}>提交新机型</Button>
      <AppDrawer
        className={styles.drawer}
        height="88dvh"
        onClose={() => { setOpen(false); }}
        open={open}
        placement="bottom"
        title="提交新机型"
      >
        <div className={styles.form}>
          <input
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(event) => {
              void chooseImage(event.target.files?.[0]);
              event.target.value = '';
            }}
            ref={inputRef}
            type="file"
          />
          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h3>创建方式</h3>
              <p>可以手动填写，也可以先上传参数图片，识别结果会回填到下方表单。</p>
            </header>
            <Button icon={<UploadOutlined />} loading={recognizing} onClick={() => { inputRef.current?.click(); }}>
              AI 识别参数图片并回填
            </Button>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h3>基础信息</h3>
              <p>机型审核通过后会进入公共型号库；提交后当前账号可立即关联此烘豆机。</p>
            </header>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                {renderLabel('品牌', true)}
                <Input onChange={(event) => { updateForm('brand', event.target.value); }} placeholder="例如：顽固 / TANK" value={form.brand} />
              </label>
              <label className={styles.field}>
                {renderLabel('型号', true)}
                <Input onChange={(event) => { updateForm('modelName', event.target.value); }} placeholder="例如：Tank200D" value={form.modelName} />
              </label>
              <label className={styles.field}>
                {renderLabel('烘焙类型', true)}
                <Select
                  onChange={(value) => { updateForm('roastType', value); }}
                  options={roastTypeOptions}
                  value={form.roastType}
                />
              </label>
              <label className={styles.field}>
                {renderLabel('建议批量')}
                <Input onChange={(event) => { updateForm('recommendedBatchGrams', event.target.value); }} placeholder="例如：200g" value={form.recommendedBatchGrams} />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h3>结构与热源</h3>
              <p>这些信息会帮助后续 AI 判断机器热惯性、能量响应和可调整项。</p>
            </header>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                {renderLabel('容量范围')}
                <Input onChange={(event) => { updateForm('capacityRangeGrams', event.target.value); }} placeholder="例如：100-250g" value={form.capacityRangeGrams} />
              </label>
              <label className={styles.field}>
                {renderLabel('烘焙仓结构')}
                <Input onChange={(event) => { updateForm('roastChamber', event.target.value); }} placeholder="例如：全直火滚筒" value={form.roastChamber} />
              </label>
              <label className={styles.field}>
                {renderLabel('热源')}
                <Input onChange={(event) => { updateForm('heatSource', event.target.value); }} placeholder="例如：燃气直火" value={form.heatSource} />
              </label>
              <label className={styles.field}>
                {renderLabel('火力调节')}
                <Input onChange={(event) => { updateForm('heatControl', event.target.value); }} placeholder="例如：燃气火力百分比调节" value={form.heatControl} />
              </label>
              <label className={styles.field}>
                {renderLabel('滚筒材质')}
                <Input onChange={(event) => { updateForm('drumMaterial', event.target.value); }} placeholder="例如：金属滚筒" value={form.drumMaterial} />
              </label>
              <label className={styles.field}>
                {renderLabel('转速控制')}
                <Input onChange={(event) => { updateForm('drumSpeedControl', event.target.value); }} placeholder="例如：不可调 / 30-70rpm" value={form.drumSpeedControl} />
              </label>
            </div>
          </section>

          <section className={styles.section}>
            <header className={styles.sectionHeader}>
              <h3>控制与辅助参数</h3>
              <p>若机器只有火力可调，请只填写火力；风温、转速等不可调项可写“不可调”。</p>
            </header>
            <div className={styles.fieldGrid}>
              <label className={styles.field}>
                {renderLabel('可调控制项')}
                <Input onChange={(event) => { updateForm('controlCapabilities', event.target.value); }} placeholder="例如：火力、风门、转速" value={form.controlCapabilities} />
              </label>
              <label className={styles.field}>
                {renderLabel('排风/风门')}
                <Input onChange={(event) => { updateForm('airflowControl', event.target.value); }} placeholder="例如：固定排风 / 可调风门" value={form.airflowControl} />
              </label>
              <label className={styles.field}>
                {renderLabel('排烟口规格')}
                <Input onChange={(event) => { updateForm('exhaustDiameter', event.target.value); }} placeholder="例如：80mm / 未知" value={form.exhaustDiameter} />
              </label>
              <label className={styles.field}>
                {renderLabel('测温方式')}
                <Input onChange={(event) => { updateForm('temperatureProbe', event.target.value); }} placeholder="例如：豆温探针、炉温显示" value={form.temperatureProbe} />
              </label>
              <label className={styles.field}>
                {renderLabel('冷却方式')}
                <Input onChange={(event) => { updateForm('coolingMethod', event.target.value); }} placeholder="例如：外置冷却盘" value={form.coolingMethod} />
              </label>
              <label className={styles.field}>
                {renderLabel('电源/功率')}
                <Input onChange={(event) => { updateForm('powerSpec', event.target.value); }} placeholder="例如：220V / 未知" value={form.powerSpec} />
              </label>
              <label className={[styles.field, styles.fullField].join(' ')}>
                {renderLabel('补充说明')}
                <Input.TextArea
                  autoSize={{ maxRows: 8, minRows: 4 }}
                  onChange={(event) => { updateForm('notes', event.target.value); }}
                  placeholder="例如：升温快、热惯性小、一爆后需要更早收火。"
                  value={form.notes}
                />
              </label>
            </div>
          </section>

          <DrawerActionBar compact>
            <Button onClick={resetAndClose}>取消</Button>
            <Button
              disabled={!form.brand.trim() || !form.modelName.trim()}
              loading={createModel.isPending}
              onClick={() => { void submit(); }}
              type="primary"
            >
              提交审核
            </Button>
          </DrawerActionBar>
        </div>
      </AppDrawer>
    </>
  );
}
