import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProductionPage } from '@/modules/production';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('ProductionPage', () => {
  it('allows selecting a roast plan for production', () => {
    renderWithQuery(<ProductionPage />);

    expect(screen.getByRole('heading', { name: '生产批次' })).toBeInTheDocument();
    expect(screen.getByText('选择烘焙计划')).toBeInTheDocument();
    expect(screen.getByText('Selected Plan')).toBeInTheDocument();
    expect(screen.getByRole('table', { name: '烘焙计划节点' })).toBeInTheDocument();
  });
});

