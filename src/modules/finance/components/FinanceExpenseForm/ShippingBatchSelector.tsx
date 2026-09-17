import AntdSelect from 'antd/es/select';
import { Controller, type Control } from 'react-hook-form';
import InputNumber from '@/shared/components/ui/input-number';
import type { FinanceExpenseFormInput } from '@/modules/finance/types';
import type { ShippingBatchOption } from './useShippingBatchOptions';
import { getBatchCountById, repeatBatchId } from './formUtils';
import { getRoastBatchDisplayName } from './batchUtils';
import styles from '../FinanceEntryForm.module.css';

interface ShippingBatchSelectorProps {
  control: Control<FinanceExpenseFormInput>;
  shippingBatchOptions: ShippingBatchOption[];
}

export function ShippingBatchSelector({ control, shippingBatchOptions }: ShippingBatchSelectorProps) {
  return (
    <Controller
      control={control}
      name="roastBatchIds"
      render={({ field }) => {
        const selectedBatchIds = field.value ?? [];
        const batchCountById = getBatchCountById(selectedBatchIds);
        const selectedUniqueBatchIds = Array.from(batchCountById.keys());
        const selectedOptions = shippingBatchOptions.filter(({ batch }) => batchCountById.has(batch.id));

        return (
          <div className={styles.shippingControl}>
            <AntdSelect
              aria-label="关联烘焙记录"
              className={styles.shippingSelect}
              maxTagCount={0}
              maxTagPlaceholder={() => `已关联 ${String(selectedUniqueBatchIds.length)} 条记录，共 ${String(selectedBatchIds.length)} 份`}
              mode="multiple"
              optionFilterProp="label"
              popupMatchSelectWidth
              options={shippingBatchOptions.map(({ batch, availableUnitCount }) => ({
                label: `${getRoastBatchDisplayName(batch)} · ${batch.roastDate.slice(0, 10)} · 可关联 ${String(availableUnitCount)} 份`,
                value: batch.id,
              }))}
              placeholder="选择销售烘焙记录"
              value={selectedUniqueBatchIds}
              onChange={(nextBatchIds: string[]) => {
                const nextValue = nextBatchIds.flatMap((batchId) => {
                  return repeatBatchId(batchId, batchCountById.get(batchId) ?? 1);
                });
                field.onChange(nextValue);
              }}
            />

            {selectedOptions.length > 0 ? (
              <div className={styles.shippingAllocationList}>
                {selectedOptions.map(({ batch, availableUnitCount }) => {
                  const batchName = getRoastBatchDisplayName(batch);
                  const count = batchCountById.get(batch.id) ?? 1;

                  return (
                    <div className={styles.shippingAllocationRow} key={batch.id}>
                      <span className={styles.shippingBatchName} title={`${batchName} · ${batch.roastDate.slice(0, 10)}`}>
                        {batchName} · {batch.roastDate.slice(0, 10)}
                      </span>
                      <InputNumber
                        aria-label={`${batchName} 关联份数`}
                        max={availableUnitCount}
                        min={1}
                        precision={0}
                        suffix="份"
                        value={Math.min(count, availableUnitCount)}
                        onChange={(nextCount) => {
                          const normalizedCount = Math.max(1, Math.min(availableUnitCount, nextCount ?? 1));
                          const nextValue = selectedUniqueBatchIds.flatMap((batchId) => {
                            return repeatBatchId(
                              batchId,
                              batchId === batch.id ? normalizedCount : batchCountById.get(batchId) ?? 1,
                            );
                          });
                          field.onChange(nextValue);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      }}
    />
  );
}
