import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { RoastAssistantMessage } from '@/modules/roast/components/RoastAssistantMessage';
import { renderWithQuery } from '@/tests/renderWithProviders';

describe('RoastAssistantMessage', () => {
  it('keeps the primary adjustment visible while collapsing legacy details and secondary suggestions', () => {
    const { container } = renderWithQuery(
      <RoastAssistantMessage
        message={{
          content: 'legacy content',
          id: 'legacy-curve-review-1',
          legacy: {
            points: ['一爆后减少降火幅度。', '下一炉保持升温率平缓下降。'],
            summary: '本次一爆后能量衔接偏弱。',
            title: 'AI 曲线复盘',
            type: 'curve_review',
          },
          role: 'assistant',
        }}
        onCreatePlan={vi.fn()}
      />,
    );

    const details = container.querySelector('details');

    expect(details).not.toHaveAttribute('open');
    expect(screen.getByText('AI 曲线复盘')).toBeInTheDocument();
    expect(screen.getByText('本次一爆后能量衔接偏弱。')).toBeInTheDocument();
    const adjustment = screen.getByText('一爆后减少降火幅度。');
    const additionalPoints = screen.getByText('查看其余 1 条建议');

    expect(adjustment).toBeVisible();
    expect(adjustment.closest('details')).toBeNull();
    expect(additionalPoints.closest('details')).not.toHaveAttribute('open');
    expect(screen.queryByText('legacy content')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('AI 曲线复盘'));
    expect(details).toHaveAttribute('open');
    fireEvent.click(additionalPoints);
    expect(additionalPoints.closest('details')).toHaveAttribute('open');
  });

  it('surfaces plan creation as an action card', () => {
    const onCreatePlan = vi.fn();

    const { container } = renderWithQuery(
      <RoastAssistantMessage
        message={{
          content: '已准备好计划草稿。',
          id: 'assistant-1',
          planDraft: {
            batchWeightGrams: 200,
            name: '下一炉测试计划',
            roastLevel: '中浅烘',
            steps: [{ airTemperature: '不可调', drumSpeed: '不可调', event: '入豆', firePower: '80%', operation: '入豆', temperature: '200°C', time: '0:00' }],
          },
          role: 'assistant',
        }}
        onCreatePlan={onCreatePlan}
      />,
    );

    expect(screen.getByText('下一炉测试计划')).toBeInTheDocument();
    expect(screen.getByText('中浅烘 · 200 g')).toBeInTheDocument();
    expect(screen.getByText('推荐烘焙计划')).toBeInTheDocument();
    expect(screen.getByText('查看具体计划')).toBeInTheDocument();
    const planDetails = container.querySelector('details');
    const createPlanButton = screen.getByRole('button', { name: '创建此计划' });

    expect(planDetails).not.toHaveAttribute('open');
    expect(planDetails?.compareDocumentPosition(createPlanButton)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getByRole('list', { name: '烘焙计划节点' })).toHaveTextContent('0:00 · 入豆');
    fireEvent.click(screen.getByText('查看具体计划'));
    expect(planDetails).toHaveAttribute('open');
    fireEvent.click(createPlanButton);
    expect(onCreatePlan).toHaveBeenCalledTimes(1);
  });
});
