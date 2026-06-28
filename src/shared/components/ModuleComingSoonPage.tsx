import { ArrowRightOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Space, Tag } from 'antd';

import styles from './ModuleComingSoonPage.module.css';

interface ModuleStat {
  label: string;
  value: string;
  tone: 'green' | 'blue' | 'amber' | 'red';
}

interface ModuleAction {
  label: string;
  primary?: boolean;
}

interface ModuleComingSoonPageProps {
  title: string;
  subtitle: string;
  stats: ModuleStat[];
  actions: ModuleAction[];
  focusItems: string[];
}

export function ModuleComingSoonPage({
  title,
  subtitle,
  stats,
  actions,
  focusItems,
}: ModuleComingSoonPageProps) {
  return (
    <main className={styles.page}>
      <section className={styles.header}>
        <div>
          <Tag color="green">V1 模块入口</Tag>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        <Space wrap>
          {actions.map((action) => (
            <Button
              icon={action.primary ? <PlusOutlined /> : <ArrowRightOutlined />}
              key={action.label}
              type={action.primary ? 'primary' : 'default'}
            >
              {action.label}
            </Button>
          ))}
        </Space>
      </section>

      <section className={styles.statGrid} aria-label={`${title}概览`}>
        {stats.map((stat) => (
          <article className={styles.statCard} data-tone={stat.tone} key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </article>
        ))}
      </section>

      <section className={styles.focusPanel}>
        <h2>近期关注</h2>
        <div className={styles.focusGrid}>
          {focusItems.map((item) => (
            <article className={styles.focusItem} key={item}>
              {item}
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

