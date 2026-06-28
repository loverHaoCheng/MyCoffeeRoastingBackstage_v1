import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RoastPage } from '@/modules/roast';
import { renderWithQuery } from '@/tests/renderWithProviders';

const getStepTimeValue = (index: number) => {
  const input = document.querySelector<HTMLInputElement>(`input[name="steps.${String(index)}.time"]`);

  expect(input).not.toBeNull();

  return input?.value;
};

describe('RoastPage', () => {
  it('renders roast plan cards and opens detail drawer for editing', async () => {
    renderWithQuery(<RoastPage />);

    expect(screen.getByLabelText('烘焙计划列表')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '烘焙计划' })).not.toBeInTheDocument();
    expect(screen.queryByText('Roast Plan')).not.toBeInTheDocument();
    expect(screen.queryByText('按时间、事件、操作、炉温和火力管理烘焙节点，生产时可直接选择计划执行。')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'check-circle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除计划' })).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: '烘焙计划节点' })).not.toBeInTheDocument();
    expect(screen.queryByText('草稿')).not.toBeInTheDocument();
    expect(screen.queryByText('8 个节点')).not.toBeInTheDocument();
    expect(screen.queryByText('计划数量')).not.toBeInTheDocument();
    expect(screen.queryByText('PLANS')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看 肯尼亚/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /编辑 肯尼亚/ }));

    expect(screen.getByText('编辑烘焙计划')).toBeInTheDocument();
    expect(screen.queryByText('肯尼亚 柏拉 AA Plus SL28 SL34 水洗（200g，手冲浅烘）')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '生豆' })).toBeInTheDocument();
    expect(screen.queryByLabelText('生豆名称')).not.toBeInTheDocument();

    const deleteButton = screen.getByRole('button', { name: '删除计划' });
    const saveButton = screen.getByRole('button', { name: '保存计划' });

    expect(deleteButton).toBeInTheDocument();
    expect(saveButton.compareDocumentPosition(deleteButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByText('烘焙节点')).toBeInTheDocument();
    expect(screen.getAllByText('火力')[0]).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上移节点 1' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下移节点 8' })).toBeDisabled();

    expect(getStepTimeValue(0)).toBe('0:00');

    fireEvent.click(screen.getByRole('button', { name: '下移节点 1' }));

    expect(getStepTimeValue(0)).toBe('1:20~1:30');

    fireEvent.click(screen.getByRole('button', { name: '上移节点 2' }));

    expect(getStepTimeValue(0)).toBe('0:00');

    fireEvent.change(screen.getByLabelText('计划名称'), {
      target: { value: '更新后的肯尼亚测试计划' },
    });
    fireEvent.click(saveButton);

    expect(await screen.findByDisplayValue('更新后的肯尼亚测试计划')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '添加节点' }));

    expect(screen.getByText('节点 9')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '删除节点 9' }));

    expect(screen.queryByText('节点 9')).not.toBeInTheDocument();
  });

  it('opens a read-only detail drawer for viewing', () => {
    renderWithQuery(<RoastPage />);

    fireEvent.click(screen.getByRole('button', { name: /查看 埃塞俄比亚/ }));

    expect(screen.getByText('查看烘焙计划')).toBeInTheDocument();
    expect(screen.getByText('计划名称')).toBeInTheDocument();
    expect(screen.getByText('烘焙节点')).toBeInTheDocument();
    expect(screen.queryByLabelText('计划名称')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '保存计划' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除计划' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '添加节点' })).not.toBeInTheDocument();
  });

  it('opens the creation drawer with JSON importer', () => {
    renderWithQuery(<RoastPage />);

    fireEvent.click(screen.getByRole('button', { name: '新建计划' }));

    expect(screen.getByRole('tab', { name: 'AI 导入计划' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '界面创建' })).toBeInTheDocument();
    expect(screen.queryByText('JSON Import')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '根据 JSON 快速创建' })).toBeInTheDocument();
  });
});
