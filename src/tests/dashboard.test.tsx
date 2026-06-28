import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DashboardPage } from '@/modules/dashboard';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('DashboardPage', () => {
  it('renders the mobile-first dashboard with core roasting metrics', async () => {
    renderWithQuery(<DashboardPage />);

    expect(await screen.findByRole('heading', { name: '咖啡烘焙工作台' })).toBeInTheDocument();
    expect(screen.getByText('待烘焙批次')).toBeInTheDocument();
    expect(screen.getByText('近期烘焙任务')).toBeInTheDocument();
    expect(screen.getByText('库存预警')).toBeInTheDocument();
  });
});

