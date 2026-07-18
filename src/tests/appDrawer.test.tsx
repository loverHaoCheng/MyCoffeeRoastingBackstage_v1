import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppDrawer } from '@/shared/components/AppDrawer';

const drawerOpenAttribute = 'data-app-drawer-open';

describe('AppDrawer', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.removeAttribute(drawerOpenAttribute);
  });

  it('marks the app as drawer-open only while an AppDrawer is open', async () => {
    const { rerender } = render(
      <AppDrawer getContainer={false} onClose={vi.fn()} open title="测试抽屉">
        抽屉内容
      </AppDrawer>,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(drawerOpenAttribute, 'true');
    });

    rerender(
      <AppDrawer getContainer={false} onClose={vi.fn()} open={false} title="测试抽屉">
        抽屉内容
      </AppDrawer>,
    );

    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute(drawerOpenAttribute);
    });
  });

  it('keeps the drawer-open mark until every open AppDrawer has closed', async () => {
    const { rerender } = render(
      <>
        <AppDrawer getContainer={false} onClose={vi.fn()} open title="第一个抽屉">
          第一个抽屉内容
        </AppDrawer>
        <AppDrawer getContainer={false} onClose={vi.fn()} open title="第二个抽屉">
          第二个抽屉内容
        </AppDrawer>
      </>,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(drawerOpenAttribute, 'true');
    });

    rerender(
      <>
        <AppDrawer getContainer={false} onClose={vi.fn()} open={false} title="第一个抽屉">
          第一个抽屉内容
        </AppDrawer>
        <AppDrawer getContainer={false} onClose={vi.fn()} open title="第二个抽屉">
          第二个抽屉内容
        </AppDrawer>
      </>,
    );

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute(drawerOpenAttribute, 'true');
    });

    rerender(
      <>
        <AppDrawer getContainer={false} onClose={vi.fn()} open={false} title="第一个抽屉">
          第一个抽屉内容
        </AppDrawer>
        <AppDrawer getContainer={false} onClose={vi.fn()} open={false} title="第二个抽屉">
          第二个抽屉内容
        </AppDrawer>
      </>,
    );

    await waitFor(() => {
      expect(document.documentElement).not.toHaveAttribute(drawerOpenAttribute);
    });
  });

  it('keeps bottom drawers on safe-area padding by default and allows action sheets to override it', async () => {
    render(
      <>
        <AppDrawer getContainer={false} onClose={vi.fn()} open placement="bottom" title="默认底部抽屉">
          <div data-testid="default-drawer-content">默认抽屉内容</div>
        </AppDrawer>
        <AppDrawer
          getContainer={false}
          onClose={vi.fn()}
          open
          placement="bottom"
          showSwipeHandle={false}
          styles={{ body: { paddingBottom: 0 } }}
          title="动作面板"
        >
          <div data-testid="custom-drawer-content">动作面板内容</div>
        </AppDrawer>
      </>,
    );

    await waitFor(() => {
      const drawerBodies = Array.from(document.querySelectorAll('.ant-drawer-body'));
      const swipeHandles = screen.getAllByRole('button', { name: '拖动关闭抽屉' });

      expect(drawerBodies).toHaveLength(2);
      expect(swipeHandles).toHaveLength(1);
      expect((drawerBodies[0] as HTMLElement).style.paddingTop).toBe('22px');
      expect((drawerBodies[0] as HTMLElement).style.paddingBottom).toContain('safe-area-inset-bottom');
      expect((drawerBodies[1] as HTMLElement).style.paddingBottom).toBe('0px');
      expect((drawerBodies[1] as HTMLElement).style.paddingTop).toBe('');
    });
  });

  it('keeps the previous drawer content visible until the close transition finishes', () => {
    vi.useFakeTimers();

    try {
      const { rerender } = render(
        <AppDrawer getContainer={false} onClose={vi.fn()} open title="测试抽屉">
          抽屉内容
        </AppDrawer>,
      );

      expect(screen.getByText('抽屉内容')).toBeInTheDocument();

      rerender(
        <AppDrawer getContainer={false} onClose={vi.fn()} open={false} title="测试抽屉">
          {null}
        </AppDrawer>,
      );

      expect(screen.getByText('抽屉内容')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(320);
      });

      expect(screen.queryByText('抽屉内容')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders a dedicated swipe handle button for bottom drawers', async () => {
    const { container } = render(
      <AppDrawer getContainer={false} onClose={vi.fn()} open placement="bottom" title="可滑动抽屉">
        抽屉内容
      </AppDrawer>,
    );

    expect(await screen.findByRole('button', { name: '拖动关闭抽屉' })).toBeInTheDocument();
    expect(container.querySelector('[data-swipe-dismissible="true"]')).not.toBeNull();
  });
});
