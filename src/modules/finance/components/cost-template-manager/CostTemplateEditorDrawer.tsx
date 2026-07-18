import PlusOutlined from '@ant-design/icons/PlusOutlined';
import SaveOutlined from '@ant-design/icons/SaveOutlined';
import Button from 'antd/es/button';
import Input from '@/shared/components/ui/input';
import InputNumber from '@/shared/components/ui/input-number';

import type { CostTemplateFormValues } from '@/modules/settings/types';
import { AppDrawer } from '@/shared/components/AppDrawer';
import { DrawerActionBar } from '@/shared/components/DrawerActionBar';

import styles from '../CostTemplateManagerPanel.module.css';

interface CostTemplateEditorDrawerProps {
  isCreatingTemplate: boolean;
  isOpen: boolean;
  onChangeField: <K extends keyof CostTemplateFormValues>(
    key: K,
    value: CostTemplateFormValues[K],
  ) => void;
  onClose: () => void;
  onSave: () => void;
  templateDraft: CostTemplateFormValues;
  templateErrors: Partial<Record<keyof CostTemplateFormValues, string>>;
}

export function CostTemplateEditorDrawer({
  isCreatingTemplate,
  isOpen,
  onChangeField,
  onClose,
  onSave,
  templateDraft,
  templateErrors,
}: CostTemplateEditorDrawerProps) {
  return (
    <AppDrawer
      className={styles.templateDrawer}
      height="82dvh"
      onClose={onClose}
      open={isOpen}
      placement="bottom"
      title={isCreatingTemplate ? '新建模板' : '编辑模板'}
    >
      <section className={styles.templateForm}>
        <section className={styles.templateSection}>
          <header className={styles.templateSectionHeader}>
            <h3>基础设置</h3>
            <p>模板会在生豆手动创建、默认规格回填与财务核算时复用。</p>
          </header>

          <div className={styles.templateFieldGrid}>
            <div className={styles.templateFieldWide} data-field-path="name">
              <label htmlFor="template-name">模板名称</label>
              <Input
                id="template-name"
                onChange={(event) => {
                  onChangeField('name', event.target.value);
                }}
                placeholder="例如 默认零售 100g"
                status={templateErrors.name ? 'error' : undefined}
                value={templateDraft.name}
              />
              <span className={styles.helpText}>{templateErrors.name ?? '用于生豆创建时快速选择模板'}</span>
            </div>

            <div className={styles.templateField} data-field-path="roastInputWeightGrams">
              <label htmlFor="template-roast-input-weight">生豆重量</label>
              <InputNumber
                id="template-roast-input-weight"
                min={1}
                onChange={(value) => {
                  onChangeField('roastInputWeightGrams', value ?? 0);
                }}
                precision={0}
                suffix="g"
                status={templateErrors.roastInputWeightGrams ? 'error' : undefined}
                value={templateDraft.roastInputWeightGrams}
              />
              <span className={styles.helpText}>{templateErrors.roastInputWeightGrams ?? '会带入生豆默认单次烘焙量'}</span>
            </div>

            <div className={styles.templateField} data-field-path="saleUnitWeightGrams">
              <label htmlFor="template-sale-unit-weight">出售单份熟豆重量</label>
              <InputNumber
                id="template-sale-unit-weight"
                min={1}
                onChange={(value) => {
                  onChangeField('saleUnitWeightGrams', value ?? 0);
                }}
                precision={0}
                suffix="g"
                status={templateErrors.saleUnitWeightGrams ? 'error' : undefined}
                value={templateDraft.saleUnitWeightGrams}
              />
              <span className={styles.helpText}>{templateErrors.saleUnitWeightGrams ?? '会带入生豆默认零售规格'}</span>
            </div>

            <div className={styles.templateField} data-field-path="dehydrationRate">
              <label htmlFor="template-dehydration-rate">脱水率</label>
              <InputNumber
                id="template-dehydration-rate"
                max={100}
                min={0}
                onChange={(value) => {
                  onChangeField('dehydrationRate', value ?? 0);
                }}
                precision={1}
                status={templateErrors.dehydrationRate ? 'error' : undefined}
                suffix="%"
                value={templateDraft.dehydrationRate}
              />
              <span className={styles.helpText}>{templateErrors.dehydrationRate ?? '用于推算单锅出豆量'}</span>
            </div>

            <div className={styles.templateField} data-field-path="targetProfitRate">
              <label htmlFor="template-target-profit-rate">目标利润率</label>
              <InputNumber
                id="template-target-profit-rate"
                min={0}
                onChange={(value) => {
                  onChangeField('targetProfitRate', value ?? 0);
                }}
                precision={1}
                status={templateErrors.targetProfitRate ? 'error' : undefined}
                suffix="%"
                value={templateDraft.targetProfitRate}
              />
              <span className={styles.helpText}>
                {templateErrors.targetProfitRate ?? '利润率 =（售价 - 单份总成本）÷ 售价 × 100%'}
              </span>
            </div>
          </div>
        </section>

        <section className={styles.templateSection}>
          <header className={styles.templateSectionHeader}>
            <h3>成本参数</h3>
            <p>以下费用按单锅计入，用于计算建议售价与利润率。</p>
          </header>

          <div className={styles.templateFieldGrid}>
            <div className={styles.templateField} data-field-path="packagingCost">
              <label htmlFor="template-packaging-cost">包装费用</label>
              <InputNumber
                id="template-packaging-cost"
                min={0}
                onChange={(value) => {
                  onChangeField('packagingCost', value ?? 0);
                }}
                precision={2}
                prefix="¥"
                status={templateErrors.packagingCost ? 'error' : undefined}
                value={templateDraft.packagingCost}
              />
              <span className={styles.helpText}>{templateErrors.packagingCost ?? '按单锅计入总成本'}</span>
            </div>

            <div className={styles.templateField} data-field-path="energyCost">
              <label htmlFor="template-energy-cost">能耗费用</label>
              <InputNumber
                id="template-energy-cost"
                min={0}
                onChange={(value) => {
                  onChangeField('energyCost', value ?? 0);
                }}
                precision={2}
                prefix="¥"
                status={templateErrors.energyCost ? 'error' : undefined}
                value={templateDraft.energyCost}
              />
              <span className={styles.helpText}>{templateErrors.energyCost ?? '按单锅计入总成本'}</span>
            </div>

            <div className={styles.templateField} data-field-path="laborCost">
              <label htmlFor="template-labor-cost">人工费用</label>
              <InputNumber
                id="template-labor-cost"
                min={0}
                onChange={(value) => {
                  onChangeField('laborCost', value ?? 0);
                }}
                precision={2}
                prefix="¥"
                status={templateErrors.laborCost ? 'error' : undefined}
                value={templateDraft.laborCost}
              />
              <span className={styles.helpText}>{templateErrors.laborCost ?? '按单锅计入总成本'}</span>
            </div>

            <div className={styles.templateField} data-field-path="otherCost">
              <label htmlFor="template-other-cost">其他费用</label>
              <InputNumber
                id="template-other-cost"
                min={0}
                onChange={(value) => {
                  onChangeField('otherCost', value ?? 0);
                }}
                precision={2}
                prefix="¥"
                status={templateErrors.otherCost ? 'error' : undefined}
                value={templateDraft.otherCost}
              />
              <span className={styles.helpText}>{templateErrors.otherCost ?? '用于礼盒、耗材等附加成本'}</span>
            </div>
          </div>

          <div className={styles.templateLinkedHint}>
            建议先固定单锅重量、出售规格和目标利润率，再补录包装、能耗与人工成本，这样后续生豆创建时回填结果会更稳定。
          </div>
        </section>

        <section className={styles.templateSection}>
          <header className={styles.templateSectionHeader}>
            <h3>备注</h3>
            <p>用于区分不同销售场景或门店约定。</p>
          </header>

          <div className={styles.templateFieldWide} data-field-path="notes">
            <label htmlFor="template-notes">模板备注</label>
            <Input.TextArea
              id="template-notes"
              autoSize={{ minRows: 3, maxRows: 5 }}
              onChange={(event) => {
                onChangeField('notes', event.target.value);
              }}
              placeholder="例如 适用于常规 100g 零售袋，包装和人工按默认门店标准分摊"
              status={templateErrors.notes ? 'error' : undefined}
              value={templateDraft.notes}
            />
            <span className={styles.helpText}>{templateErrors.notes ?? '便于团队区分不同销售场景'}</span>
          </div>
        </section>

        <DrawerActionBar compact>
          <Button onClick={onClose}>取消</Button>
          <Button
            icon={isCreatingTemplate ? <PlusOutlined /> : <SaveOutlined />}
            onClick={onSave}
            type="primary"
          >
            {isCreatingTemplate ? '创建模板' : '保存模板'}
          </Button>
        </DrawerActionBar>
      </section>
    </AppDrawer>
  );
}
