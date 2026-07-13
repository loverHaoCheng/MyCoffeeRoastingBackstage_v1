import { cleanup, render, waitFor } from '@testing-library/react';
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
});
