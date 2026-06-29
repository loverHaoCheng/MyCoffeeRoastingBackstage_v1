import { DeleteOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, DatePicker, Input, InputNumber, Select, Tag } from 'antd';
import dayjs from 'dayjs';
import { useState } from 'react';

import type { RoastBatchRecord, RoastBatchUpdateInput } from '@/modules/roast/types/roastBatch';

import styles from './RoastBatchDrawer.module.css';

type DrawerMode = 'view' | 'edit';
const ROAST_DATE_TIME_FORMAT = 'YYYY-MM-DD HH:mm';

const toPickerValue = (value: string) => {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);

  return parsed.isValid() ? parsed : null;
};

interface RoastBatchDrawerProps {
  batch: RoastBatchRecord | null;
  mode: DrawerMode;
  onClose: () => void;
  onDelete?: (batch: RoastBatchRecord) => void;
  onModeChange?: (mode: DrawerMode) => void;
  onUpdate?: (batchId: string, input: RoastBatchUpdateInput) => Promise<void>;
}

const ROAST_LEVELS = ['极浅', '浅焙', '肉桂', '中浅', '中焙', '中深', '深焙', '极深'];

export function RoastBatchDrawer({ batch, mode, onClose, onDelete, onModeChange, onUpdate }: RoastBatchDrawerProps) {
  if (!batch) return null;

  const isView = mode === 'view';

  // 编辑模式下的表单状态
  const [form, setForm] = useState({
    roastDate: batch.roastDate,
    greenBeanId: batch.greenBeanId,
    greenBeanName: batch.greenBeanName,
    roastedBeanName: batch.roastedBeanName || '',
    roastPlanId: batch.roastPlanId || '',
    roastPlanName: batch.roastPlanName || '',
    inputWeightGrams: batch.inputWeightGrams,
    outputWeightGrams: batch.outputWeightGrams,
    roastLevel: batch.roastLevel,
    developmentRatio: batch.developmentRatio,
    firstCrackTime: batch.firstCrackTime,
    totalRoastTime: batch.totalRoastTime,
    notes: batch.notes || '',
  });

  const handleSave = async () => {
    if (!batch || !onUpdate) return;
    const updateInput: RoastBatchUpdateInput = {
      roastDate: form.roastDate,
      greenBeanId: form.greenBeanId,
      greenBeanName: form.greenBeanName,
      roastedBeanName: form.roastedBeanName.trim() || form.greenBeanName,
      roastPlanId: form.roastPlanId || undefined,
      roastPlanName: form.roastPlanName || undefined,
      inputWeightGrams: form.inputWeightGrams,
      outputWeightGrams: form.outputWeightGrams,
      roastLevel: form.roastLevel,
      developmentRatio: form.developmentRatio,
      firstCrackTime: form.firstCrackTime,
      totalRoastTime: form.totalRoastTime,
      notes: form.notes || undefined,
    };
    await onUpdate(batch.id, updateInput);
  };

  const lossRate = form.inputWeightGrams > 0
    ? (((form.inputWeightGrams - form.outputWeightGrams) / form.inputWeightGrams) * 100).toFixed(1)
    : '-';

  return (
    <div className={styles.drawer}>
      {/* 头部 */}
      <header className={styles.header}>
        <div className={styles.headerTitle}>
          <strong>{isView ? '烘焙记录详情' : '编辑烘焙记录'}</strong>
        </div>
        <div className={styles.headerActions}>
          {isView && onModeChange && (
            <Button
              icon={<EyeOutlined />}
              onClick={() => onModeChange('edit')}
              size="small"
              type="text"
            >
              编辑
            </Button>
          )}
          {!isView && (
            <Button
              icon={<SaveOutlined />}
              onClick={handleSave}
              size="small"
              type="primary"
            >
              保存
            </Button>
          )}
        </div>
      </header>

      {/* 内容区 */}
      <div className={styles.body}>
        {/* 基本信息 */}
        <section className={styles.section}>
          <h4>基本信息</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>烘焙日期</span>
              {isView ? (
                <span className={styles.fieldValue}>
                  {toPickerValue(batch.roastDate)?.format(ROAST_DATE_TIME_FORMAT) ?? batch.roastDate}
                </span>
              ) : (
                <DatePicker
                  format={ROAST_DATE_TIME_FORMAT}
                  placeholder="选择烘焙日期与时间"
                  showTime={{ format: 'HH:mm' }}
                  value={toPickerValue(form.roastDate)}
                  onChange={(date) =>
                    setForm((f) => ({
                      ...f,
                      roastDate: date ? date.second(0).millisecond(0).toISOString() : '',
                    }))
                  }
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>烘焙程度</span>
              {isView ? (
                <Tag color={getRoastLevelColor(batch.roastLevel)}>{batch.roastLevel}</Tag>
              ) : (
                <Select
                  value={form.roastLevel}
                  onChange={(v) => setForm((f) => ({ ...f, roastLevel: v }))}
                  options={ROAST_LEVELS.map((l) => ({ label: l, value: l }))}
                  style={{ width: '100%' }}
                />
              )}
            </div>
          </div>
        </section>

        {/* 生豆信息 */}
        <section className={styles.section}>
          <h4>生豆信息</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>生豆</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.greenBeanName}</span>
              ) : (
                <>
                  <Input value={form.greenBeanName} disabled placeholder="选择生豆" />
                  {/* TODO: 接入生豆选择组件 */}
                </>
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>熟豆名称</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.roastedBeanName || batch.greenBeanName}</span>
              ) : (
                <Input
                  value={form.roastedBeanName}
                  onChange={(event) => setForm((f) => ({ ...f, roastedBeanName: event.target.value }))}
                  placeholder={form.greenBeanName || '未填写时默认继承生豆名称'}
                />
              )}
            </div>
          </div>
        </section>

        {/* 烘焙数据 */}
        <section className={styles.section}>
          <h4>烘焙数据</h4>
          <div className={styles.fieldGrid}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>入豆量 (g)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.inputWeightGrams} g</span>
              ) : (
                <InputNumber
                  value={form.inputWeightGrams}
                  onChange={(v) => setForm((f) => ({ ...f, inputWeightGrams: v || 0 }))}
                  min={0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>出豆量 (g)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.outputWeightGrams} g</span>
              ) : (
                <InputNumber
                  value={form.outputWeightGrams}
                  onChange={(v) => setForm((f) => ({ ...f, outputWeightGrams: v || 0 }))}
                  min={0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>失水率</span>
              <span className={styles.fieldValue}>{lossRate}%</span>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>发展比 (%)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.developmentRatio ?? '-'}%</span>
              ) : (
                <InputNumber
                  value={form.developmentRatio}
                  onChange={(v) => setForm((f) => ({ ...f, developmentRatio: v ?? undefined }))}
                  min={0}
                  max={100}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>一爆时间 (s)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.firstCrackTime ?? '-'} s</span>
              ) : (
                <InputNumber
                  value={form.firstCrackTime}
                  onChange={(v) => setForm((f) => ({ ...f, firstCrackTime: v ?? undefined }))}
                  min={0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>总烘焙时间 (s)</span>
              {isView ? (
                <span className={styles.fieldValue}>{batch.totalRoastTime ?? '-'} s</span>
              ) : (
                <InputNumber
                  value={form.totalRoastTime}
                  onChange={(v) => setForm((f) => ({ ...f, totalRoastTime: v ?? undefined }))}
                  min={0}
                  style={{ width: '100%' }}
                />
              )}
            </div>
          </div>
        </section>

        {/* 备注 */}
        <section className={styles.section}>
          <h4>备注</h4>
          {isView ? (
            <p className={styles.notes}>{batch.notes || '暂无备注'}</p>
          ) : (
            <Input.TextArea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="记录烘焙心得、调整建议等..."
              rows={3}
            />
          )}
        </section>

        {/* 图片记录（预留接口） */}
        <section className={styles.section}>
          <h4>图片记录</h4>
          {isView ? (
            batch.imageUrls && batch.imageUrls.length > 0 ? (
              <div className={styles.imageGrid}>
                {batch.imageUrls.map((url, i) => (
                  <div key={i} className={styles.imagePlaceholder}>
                    <img src={url} alt={`烘焙记录图片 ${i + 1}`} />
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyText}>暂无图片</p>
            )
          ) : (
            <div className={styles.imageUploadPlaceholder}>
              <p>点击上传图片（预留接口）</p>
            </div>
          )}
        </section>
      </div>

      {/* 底部操作栏（编辑模式） */}
      {!isView && (
        <footer className={styles.footer}>
          <Button onClick={onClose} block>取消</Button>
          <Button type="primary" onClick={handleSave} block>完成</Button>
        </footer>
      )}

      {/* 查看模式的删除按钮 */}
      {isView && onDelete && (
        <footer className={styles.footer}>
          <Button danger icon={<DeleteOutlined />} onClick={() => onDelete(batch)} block>
            删除此记录
          </Button>
        </footer>
      )}
    </div>
  );
}

function getRoastLevelColor(level: string): string {
  const map: Record<string, string> = {
    '极浅': 'blue', '浅焙': 'cyan', '肉桂': 'green',
    '中浅': 'lime', '中焙': 'gold', '中深': 'orange',
    '深焙': 'red', '极深': 'volcano',
  };
  return map[level] || 'default';
}
