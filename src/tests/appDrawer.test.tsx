import { act, cleanup, queryAllByRole, render, screen, waitFor } from '@testing-library/react';
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

  it('does not reserve swipe-handle space by default and allows explicit opt-in', async () => {
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
      const swipeHandles = queryAllByRole(document.body, 'button', { name: '拖动关闭抽屉' });

      expect(drawerBodies).toHaveLength(2);
      expect(swipeHandles).toHaveLength(0);
      expect((drawerBodies[0] as HTMLElement).style.paddingTop).toBe('');
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
      expect(document.querySelector('.ant-drawer')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not mount a drawer that has never been opened', () => {
    const { container } = render(
      <AppDrawer getContainer={false} onClose={vi.fn()} open={false} title="关闭的抽屉">
        不应挂载的内容
      </AppDrawer>,
    );

    expect(container.querySelector('.ant-drawer')).toBeNull();
    expect(screen.queryByText('不应挂载的内容')).not.toBeInTheDocument();
  });

  it('renders drawer content immediately when a closed drawer reopens', () => {
    const { rerender } = render(
      <AppDrawer getContainer={false} onClose={vi.fn()} open={false} title="测试抽屉">
        抽屉内容
      </AppDrawer>,
    );

    rerender(
      <AppDrawer getContainer={false} onClose={vi.fn()} open title="测试抽屉">
        抽屉内容
      </AppDrawer>,
    );

    expect(screen.getByText('抽屉内容')).toBeInTheDocument();
  });

  it('renders a dedicated swipe handle button when explicitly enabled', async () => {
    const { container } = render(
      <AppDrawer getContainer={false} onClose={vi.fn()} open placement="bottom" showSwipeHandle title="可滑动抽屉">
        抽屉内容
      </AppDrawer>,
    );

    expect(await screen.findByRole('button', { name: '拖动关闭抽屉' })).toBeInTheDocument();
    expect(container.querySelector('[data-swipe-dismissible="true"]')).not.toBeNull();
  });

  it('identifies the drawer surface placement for shared placement styling', () => {
    const { container } = render(
      <AppDrawer getContainer={false} onClose={vi.fn()} open placement="bottom" title="底部抽屉">
        抽屉内容
      </AppDrawer>,
    );

    expect(container.querySelector('.ant-drawer-content')).toHaveAttribute('data-placement', 'bottom');
  });
});
