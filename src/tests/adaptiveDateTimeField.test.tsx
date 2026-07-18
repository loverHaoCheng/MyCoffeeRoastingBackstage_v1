import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AdaptiveDateTimeField } from '@/shared/components/AdaptiveDateTimeField';
import { createMatchMediaStub } from '@/tests/settingsPage.test.shared';

describe('AdaptiveDateTimeField', () => {
  it('uses a bottom drawer selector on coarse-pointer devices', () => {
    vi.mocked(window.matchMedia).mockImplementation(
      createMatchMediaStub((query) => query === '(pointer: coarse)'),
    );

    const handleChange = vi.fn();

    render(
      <AdaptiveDateTimeField
        ariaLabel="烘焙日期"
        mode="datetime"
        placeholder="选择烘焙日期与时间"
        value=""
        onChange={handleChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '烘焙日期' }));

    expect(screen.getByRole('dialog', { name: '烘焙日期' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '烘焙日期' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: '烘焙日期年份' }), {
      target: { value: 'number:2027' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '烘焙日期月份' }), {
      target: { value: 'number:2' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '烘焙日期日期' }), {
      target: { value: 'number:4' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '烘焙日期小时' }), {
      target: { value: 'number:9' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: '烘焙日期分钟' }), {
      target: { value: 'number:30' },
    });
    fireEvent.click(screen.getByRole('button', { name: /确\s*定/ }));

    expect(handleChange).toHaveBeenCalledWith(new Date(2027, 1, 4, 9, 30, 0, 0).toISOString());
  });
});
