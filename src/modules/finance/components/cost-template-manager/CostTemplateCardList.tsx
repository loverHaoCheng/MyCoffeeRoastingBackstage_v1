import DownOutlined from '@ant-design/icons/DownOutlined';
import Button from 'antd/es/button';
import Popconfirm from 'antd/es/popconfirm';
import Tag from 'antd/es/tag';

import type { CostTemplate } from '@/modules/settings/types';

import styles from '../CostTemplateManagerPanel.module.css';

interface CostTemplateCardListProps {
  collapseRegionId: string;
  editingTemplateId: null | string;
  isCollapsed: boolean;
  isTemplateDrawerOpen: boolean;
  onDeleteTemplate: (template: CostTemplate) => void;
  onEditTemplate: (template: CostTemplate) => void;
  onToggleCollapse: () => void;
  onUpdateDefaultTemplate: (templateId: null | string) => void;
  primaryTemplate: CostTemplate | null;
  shouldShowCollapseToggle: boolean;
  templates: CostTemplate[];
}

export function CostTemplateCardList({
  collapseRegionId,
  editingTemplateId,
  isCollapsed,
  isTemplateDrawerOpen,
  onDeleteTemplate,
  onEditTemplate,
  onToggleCollapse,
  onUpdateDefaultTemplate,
  primaryTemplate,
  shouldShowCollapseToggle,
  templates,
}: CostTemplateCardListProps) {
  if (templates.length === 0) {
    return <div className={styles.emptyState}>还没有成本模板，先新建一个模板即可在财务与生豆流程中复用。</div>;
  }

  return (
    <>
      <div className={styles.templateGrid} id={collapseRegionId}>
        {templates.map((template) => {
          const isDefault = template.id === primaryTemplate?.id;
          const isEditing = isTemplateDrawerOpen && template.id === editingTemplateId;
          const isSecondaryTemplate = template.id !== primaryTemplate?.id;

          return (
            <div
              className={styles.templateItem}
              data-collapsed={isSecondaryTemplate && isCollapsed}
              key={template.id}
            >
              <div className={styles.templateItemInner}>
                <article className={styles.templateCard} data-active={isEditing}>
                  <div className={styles.templateCardHeader}>
                    <div className={styles.templateTitleBlock}>
                      <strong>{template.name}</strong>
                      {isDefault ? <Tag>默认模板</Tag> : null}
                    </div>
                    <span className={styles.templateMeta}>
                      生豆 {template.roastInputWeightGrams}g · 单份 {template.saleUnitWeightGrams}g · 利润率 {template.targetProfitRate}%
                    </span>
                  </div>
                  <div className={styles.templateStats}>
                    <span>脱水率 {template.dehydrationRate}%</span>
                    <span>包装 ¥{template.packagingCost.toFixed(2)}</span>
                    <span>能耗 ¥{template.energyCost.toFixed(2)}</span>
                    <span>人工 ¥{template.laborCost.toFixed(2)}</span>
                    <span>其他 ¥{template.otherCost.toFixed(2)}</span>
                  </div>
                  {template.notes ? <p className={styles.templateNotes}>{template.notes}</p> : null}
                  <div className={styles.templateActions}>
                    <Button
                      onClick={() => {
                        onEditTemplate(template);
                      }}
                      type={isEditing ? 'primary' : 'default'}
                    >
                      编辑
                    </Button>
                    <Button
                      onClick={() => {
                        onUpdateDefaultTemplate(isDefault ? null : template.id);
                      }}
                    >
                      {isDefault ? '取消默认' : '设为默认'}
                    </Button>
                    <Popconfirm
                      cancelText="取消"
                      okText="删除"
                      onConfirm={() => {
                        onDeleteTemplate(template);
                      }}
                      title={`删除模板「${template.name}」？此操作不可撤销。`}
                    >
                      <Button danger>
                        删除
                      </Button>
                    </Popconfirm>
                  </div>
                </article>
              </div>
            </div>
          );
        })}
      </div>

      {shouldShowCollapseToggle ? (
        <div className={styles.collapseFooter}>
          <Button
            aria-controls={collapseRegionId}
            aria-expanded={!isCollapsed}
            className={styles.collapseToggle}
            icon={<DownOutlined />}
            onClick={onToggleCollapse}
            type="text"
          >
            {isCollapsed ? '展开' : '收起'}
          </Button>
        </div>
      ) : null}
    </>
  );
}
