import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppRoastedBeanConnectionProbe } from '@/app/components/AppRoastedBeanConnectionProbe';
import { useAuthStore } from '@/modules/auth/store/useAuthStore';
import { pocketBaseConnectionRuntimeService } from '@/modules/settings/services/pocketBaseConnectionRuntime.service';
import { pocketBaseConnectionProbeService } from '@/modules/settings/services/pocketBaseConnectionProbe.service';
import { useSettingsStore } from '@/modules/settings/store';
import { createDefaultPocketBaseConnectionSettings } from '@/modules/settings/types';

describe('AppRoastedBeanConnectionProbe', () => {
  const verifySpy = vi.spyOn(pocketBaseConnectionProbeService, 'verify');
  const defaultLoadPocketBaseConnections = useSettingsStore.getState().loadPocketBaseConnections;

  beforeEach(() => {
    pocketBaseConnectionRuntimeService.clear();
    verifySpy.mockReset();
    useAuthStore.setState({
      status: 'authenticated',
      user: {
        email: 'tester@example.com',
        id: 'test-user',
      },
    });
    useSettingsStore.setState({
      loadPocketBaseConnections: vi.fn().mockResolvedValue(undefined),
      pocketBaseConnections: {
        ...createDefaultPocketBaseConnectionSettings(),
        roastedBean: {
          projectUrl: 'https://demo.supabase.co',
          publishableKey: 'sb_publishable_demo',
        },
      },
    });
  });

  afterEach(() => {
    cleanup();
    useSettingsStore.setState({
      loadPocketBaseConnections: defaultLoadPocketBaseConnections,
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });
    useAuthStore.setState({
      status: 'unauthenticated',
      user: null,
    });
    pocketBaseConnectionRuntimeService.clear();
  });

  it('loads configuration and probes Supabase once after authentication', async () => {
    verifySpy.mockResolvedValue(undefined);
    const loadPocketBaseConnections = useSettingsStore.getState().loadPocketBaseConnections;
    const { rerender } = render(<AppRoastedBeanConnectionProbe />);

    await waitFor(() => {
      expect(verifySpy).toHaveBeenCalledWith('roastedBean', {
        projectUrl: 'https://demo.supabase.co',
        publishableKey: 'sb_publishable_demo',
      });
    });

    expect(loadPocketBaseConnections).toHaveBeenCalledWith({ forceRemote: true });
    expect(
      pocketBaseConnectionRuntimeService.readRoastedBeanConnectionStatus(
        useSettingsStore.getState().pocketBaseConnections.roastedBean,
      ),
    ).toBe('connected');

    rerender(<AppRoastedBeanConnectionProbe />);

    expect(verifySpy).toHaveBeenCalledTimes(1);
  });

  it('does not probe when no Supabase connection is configured', async () => {
    useSettingsStore.setState({
      pocketBaseConnections: createDefaultPocketBaseConnectionSettings(),
    });

    render(<AppRoastedBeanConnectionProbe />);

    await waitFor(() => {
      expect(useSettingsStore.getState().loadPocketBaseConnections).toHaveBeenCalledWith({ forceRemote: true });
    });

    expect(verifySpy).not.toHaveBeenCalled();
  });
});
