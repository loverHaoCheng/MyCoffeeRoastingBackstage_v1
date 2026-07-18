import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FinanceIncomeForm } from '@/modules/finance/components';

describe('FinanceIncomeForm', () => {
  it('submits the income form after entering a valid amount', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<FinanceIncomeForm isSaving={false} onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('收入金额'), {
      target: {
        value: '128',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存收入记录' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        amount: 128,
        channel: 'retail',
        status: 'received',
        title: '零售收入',
      }));
    });
  });

  it('shows a validation error when saving without an income amount', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<FinanceIncomeForm isSaving={false} onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: '保存收入记录' }));

    expect(await screen.findByText('请输入有效的收入金额')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
