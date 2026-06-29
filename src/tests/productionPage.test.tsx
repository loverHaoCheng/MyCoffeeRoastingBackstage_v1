import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProductionPage } from '@/modules/production';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('ProductionPage (烘焙历史)', () => {
  it('renders the roast history page with search and FAB', () => {
    renderWithQuery(<ProductionPage />);

    expect(screen.getByLabelText('搜索烘焙历史')).toBeInTheDocument();
    expect(screen.getByLabelText('新增烘焙记录')).toBeInTheDocument();
  });
});
