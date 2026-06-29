import { fireEvent, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BeanPage } from '@/modules/bean';
import { renderWithQuery } from '@/tests/renderWithProviders';
import { localGreenBeanStorageKey } from '@/modules/bean/services';

describe('BeanPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('renders the bean inventory workspace and filters low stock beans', async () => {
    renderWithQuery(<BeanPage />);

    const summary = screen.getByLabelText('生豆库存概览');

    expect(summary).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存筛选')).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存列表')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '同步生豆数据' })).not.toBeInTheDocument();
    expect(within(summary).queryByText('在库批次')).not.toBeInTheDocument();
    expect(within(summary).queryByText('低库存')).not.toBeInTheDocument();
    expect(await screen.findByText('肯尼亚 柏拉 AA Plus SL28 SL34 水洗')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('低库存'));

    expect(screen.getByText('危地马拉 安提瓜 SHB')).toBeInTheDocument();
    expect(screen.queryByText('巴西 喜拉多 日晒')).not.toBeInTheDocument();
  });

  it('creates a local bean from the drawer and renders it in the inventory list', async () => {
    renderWithQuery(<BeanPage />);

    fireEvent.click(screen.getByRole('button', { name: '新增生豆' }));

    expect(await screen.findByText('新增生豆')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('生豆编号'), { target: { value: 'GB-LOCAL-001' } });
    fireEvent.change(screen.getByLabelText('显示名称'), { target: { value: '测试庄园 水洗 批次' } });
    fireEvent.change(screen.getByLabelText('豆种'), { target: { value: '74110' } });
    fireEvent.change(screen.getByLabelText('产季'), { target: { value: '2026' } });
    fireEvent.change(screen.getByLabelText('处理法'), { target: { value: '水洗' } });
    fireEvent.change(screen.getByLabelText('产地国家'), { target: { value: '埃塞俄比亚' } });
    fireEvent.change(screen.getByLabelText('产区'), { target: { value: '古吉' } });
    fireEvent.change(screen.getByLabelText('购买重量'), { target: { value: '30000' } });
    fireEvent.change(screen.getByLabelText('购买总价'), { target: { value: '2100' } });
    fireEvent.change(screen.getByLabelText('单次烘焙量'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('出售单份重量'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('出售单份售价'), { target: { value: '88' } });

    fireEvent.click(screen.getByRole('button', { name: /创建生豆/ }));

    expect(await screen.findByText('测试庄园 水洗 批次')).toBeInTheDocument();
    expect(window.localStorage.getItem(localGreenBeanStorageKey)).toContain('GB-LOCAL-001');
  });
});
