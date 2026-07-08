import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { usePocketBaseConnectionSettings } from '@/modules/settings/hooks';
import { useSettingsStore } from '@/modules/settings/store';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';

function HookHarness() {
  const {
    loadPocketBaseConnections,
    pocketBaseConnections,
    resetPocketBaseConnections,
    savePocketBaseConnections,
  } = usePocketBaseConnectionSettings();

  return (
    <div>
      <span data-testid="green-bean-url">{pocketBaseConnections.greenBean.projectUrl}</span>
      <span data-testid="aliases-ready">
        {[
          typeof loadPocketBaseConnections,
          typeof savePocketBaseConnections,
          typeof resetPocketBaseConnections,
        ].join(',')}
      </span>
    </div>
  );
}

describe('usePocketBaseConnectionSettings', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      pocketBaseConnections: {
        ...createDefaultPocketBaseConnectionSettings(),
        greenBean: {
          projectUrl: 'http://81.70.224.75',
          publishableKey: '',
        },
      },
    });
  });

  it('returns pocket base connection helpers', () => {
    render(<HookHarness />);

    expect(screen.getByTestId('green-bean-url')).toHaveTextContent(
      'http://81.70.224.75',
    );
    expect(screen.getByTestId('aliases-ready')).toHaveTextContent(
      'function,function,function',
    );
  });
});
