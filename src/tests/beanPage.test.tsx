import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BeanPage } from '@/modules/bean';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('BeanPage', () => {
  it('renders the bean inventory workspace and filters low stock beans', async () => {
    renderWithQuery(<BeanPage />);

    expect(await screen.findByRole('heading', { name: '生豆库存' })).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存概览')).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存筛选')).toBeInTheDocument();
    expect(screen.getByLabelText('生豆库存列表')).toBeInTheDocument();
    expect(await screen.findByText('肯尼亚 柏拉 AA Plus SL28 SL34 水洗')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('低库存'));

    expect(screen.getByText('危地马拉 安提瓜 SHB')).toBeInTheDocument();
    expect(screen.queryByText('巴西 喜拉多 日晒')).not.toBeInTheDocument();
  });
});
