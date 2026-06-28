import { Tag, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import type { RoastTask } from '@/modules/dashboard/types';

import styles from './RoastTaskTable.module.css';

const statusColor: Record<RoastTask['status'], string> = {
  待烘焙: 'blue',
  进行中: 'green',
  待冷却: 'orange',
  已完成: 'default',
};

interface RoastTaskTableProps {
  tasks: RoastTask[];
}

export function RoastTaskTable({ tasks }: RoastTaskTableProps) {
  const columns: ColumnsType<RoastTask> = [
    {
      title: '批次',
      dataIndex: 'batchNo',
      key: 'batchNo',
      width: 168,
    },
    {
      title: '生豆',
      dataIndex: 'beanName',
      key: 'beanName',
      width: 220,
    },
    {
      title: '烘焙度',
      dataIndex: 'roastLevel',
      key: 'roastLevel',
      width: 96,
    },
    {
      title: '时间',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      width: 92,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 96,
      render: (status: RoastTask['status']) => <Tag color={statusColor[status]}>{status}</Tag>,
    },
    {
      title: '负责人',
      dataIndex: 'operator',
      key: 'operator',
      width: 96,
    },
  ];

  return (
    <div className={styles.tableFrame}>
      <Table
        columns={columns}
        dataSource={tasks}
        pagination={false}
        rowKey="id"
        scroll={{ x: 768 }}
        size="middle"
      />
    </div>
  );
}
