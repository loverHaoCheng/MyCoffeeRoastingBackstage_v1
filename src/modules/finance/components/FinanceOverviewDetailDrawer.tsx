import DeleteOutlined from "@ant-design/icons/DeleteOutlined";
import Button from "antd/es/button";
import Empty from "antd/es/empty";

import type { FinanceOverviewDrilldownPayload } from '@/modules/finance/types';
import { AppDrawer } from '@/shared/components/AppDrawer';

import styles from './FinanceOverviewDetailDrawer.module.css';

interface FinanceOverviewDetailDrawerProps {
  isWide: boolean;
  isDeleting?: boolean;
  onClose: () => void;
  onDeleteRecord?: (recordId: string) => void;
  onUnsupportedDelete?: (message: string) => void;
  open: boolean;
  payload: FinanceOverviewDrilldownPayload | null;
}

const formatCurrency = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
});

export function FinanceOverviewDetailDrawer({
  isWide,
  isDeleting = false,
  onClose,
  onDeleteRecord,
  onUnsupportedDelete,
  open,
  payload,
}: FinanceOverviewDetailDrawerProps) {
  const showDeleteAction = payload?.key === 'totalExpenses' || payload?.key === 'realizedIncome';

  return (
    <AppDrawer
      className={styles.drawer}
      destroyOnHidden
      height={isWide ? undefined : '72dvh'}
      onClose={onClose}
      open={open}
      placement={isWide ? 'right' : 'bottom'}
      title={payload?.title ?? '财务明细'}
      width={isWide ? 420 : undefined}
    >
      <div className={styles.body}>
        <header className={styles.summary}>
          <span className={styles.summaryLabel}>{payload?.title ?? '财务明细'}</span>
          <strong className={styles.summaryValue}>¥{formatCurrency.format(payload?.total ?? 0)}</strong>
        </header>

        {payload && payload.records.length > 0 ? (
          <div className={styles.list}>
            {payload.records.map((record) => (
              <article className={styles.item} key={record.id}>
                <div className={styles.itemMain}>
                  <div className={styles.itemHeading}>
                    <div className={styles.itemTitleGroup}>
                      <strong className={styles.itemTitle}>{record.title}</strong>
                      <div className={styles.itemActions}>
                        <span className={styles.itemAmount}>¥{formatCurrency.format(record.amount)}</span>
                        {showDeleteAction ? (
                          <Button
                            aria-label={record.deletable ? `删除 ${record.title}` : `查看 ${record.title} 删除说明`}
                            className={styles.deleteButton}
                            danger={record.deletable}
                            icon={<DeleteOutlined />}
                            loading={isDeleting && record.deletable}
                            onClick={() => {
                              if (record.deletable) {
                                onDeleteRecord?.(record.id);
                                return;
                              }

                              onUnsupportedDelete?.(record.deleteHint ?? '当前记录不支持直接删除。');
                            }}
                            size="small"
                            type="text"
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                  <div className={styles.metaRow}>
                    <span className={styles.meta}>{record.date}</span>
                    <span className={styles.metaDot} />
                    <span className={styles.meta}>{record.categoryLabel}</span>
                    <span className={styles.metaDot} />
                    <span className={styles.meta}>{record.sourceLabel}</span>
                  </div>
                  {record.notes ? <p className={styles.notes}>{record.notes}</p> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty className={styles.empty} description={payload?.emptyText ?? '当前没有可展示的记录'} />
        )}
      </div>
    </AppDrawer>
  );
}
