import { DownOutlined } from '@ant-design/icons';
import { Button, Input, Tag } from 'antd';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { supabaseConnectionFormSectionSchema } from '@/modules/settings/schemas';
import { supabaseConnectionProbeService } from '@/modules/settings/services/pocketBaseConnectionProbe.service';
import {
  hasSyncableRoastedBeanConnection,
  supabaseRoastedBeanConnectionSyncService,
} from '@/modules/settings/services/supabaseRoastedBeanConnectionSync.service';
import { useSettingsStore } from '@/modules/settings/store';
import {
  normalizeRoastedBeanPocketBaseProjectConnection,
  type PocketBaseProjectConnection,
} from '@/modules/settings/types';

import styles from './RoastedBeanConnectionCard.module.css';

type ConnectionFieldKey = keyof Pick<PocketBaseProjectConnection, 'projectUrl' | 'publishableKey'>;
type ConnectionStatus = 'checking' | 'connected' | 'disconnected' | 'unconfigured';

const EMPTY_CONNECTION: PocketBaseProjectConnection = {
  projectUrl: '',
  publishableKey: '',
};

const normalizeConnectionDraft = (
  connection: Partial<PocketBaseProjectConnection> | null | undefined,
): PocketBaseProjectConnection => {
  return normalizeRoastedBeanPocketBaseProjectConnection(connection);
};

export function RoastedBeanConnectionCard() {
  const pocketBaseConnections = useSettingsStore((state) => state.pocketBaseConnections);
  const savePocketBaseConnections = useSettingsStore((state) => state.savePocketBaseConnections);
  const [draft, setDraft] = useState<PocketBaseProjectConnection>(() =>
    normalizeConnectionDraft(pocketBaseConnections.roastedBean),
  );
  const [errors, setErrors] = useState<Partial<Record<ConnectionFieldKey, string>>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => {
    return hasSyncableRoastedBeanConnection(pocketBaseConnections.roastedBean)
      ? 'disconnected'
      : 'unconfigured';
  });
  const [isCollapsed, setIsCollapsed] = useState(true);
  const persistedProjectUrl = pocketBaseConnections.roastedBean.projectUrl;
  const persistedPublishableKey = pocketBaseConnections.roastedBean.publishableKey;

  const statusTagText = {
    checking: '检测中',
    connected: '已连通',
    disconnected: '未连通',
    unconfigured: '未配置',
  }[connectionStatus];
  const statusTagColor = connectionStatus === 'connected' ? 'green' : 'default';
  const connectionSchema = useMemo(() => supabaseConnectionFormSectionSchema(false), []);

  useEffect(() => {
    const nextDraft = normalizeConnectionDraft({
      projectUrl: persistedProjectUrl,
      publishableKey: persistedPublishableKey,
    });

    setDraft(nextDraft);
    setErrors({});
  }, [persistedProjectUrl, persistedPublishableKey]);

  const syncConnection = useCallback(async (connection: PocketBaseProjectConnection): Promise<void> => {
    if (!hasSyncableRoastedBeanConnection(connection)) {
      setConnectionStatus('unconfigured');
      return;
    }

    setConnectionStatus('checking');

    try {
      await supabaseConnectionProbeService.verify('roastedBean', connection);
      await supabaseRoastedBeanConnectionSyncService.syncLocalChange(connection);
      setConnectionStatus('connected');
    } catch {
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    const currentConnection = normalizeConnectionDraft({
      projectUrl: persistedProjectUrl,
      publishableKey: persistedPublishableKey,
    });

    if (!hasSyncableRoastedBeanConnection(currentConnection)) {
      setConnectionStatus('unconfigured');
      return;
    }

    setConnectionStatus('checking');

    void (async () => {
      try {
        await supabaseConnectionProbeService.verify('roastedBean', currentConnection);
        setConnectionStatus('connected');
      } catch {
        setConnectionStatus('disconnected');
      }
    })();
  }, [persistedProjectUrl, persistedPublishableKey]);

  const persistDraft = (nextDraft: PocketBaseProjectConnection = draft): void => {
    const validation = connectionSchema.safeParse(nextDraft);

    if (!validation.success) {
      const nextErrors: Partial<Record<ConnectionFieldKey, string>> = {};

      validation.error.issues.forEach((issue) => {
        const key = issue.path[0] as ConnectionFieldKey | undefined;

        if (!key) {
          return;
        }

        nextErrors[key] = issue.message;
      });

      setErrors(nextErrors);
      return;
    }

    const normalized = normalizeConnectionDraft(validation.data);
    const nextSignature = JSON.stringify(normalized);
    const currentSignature = JSON.stringify(
      normalizeConnectionDraft(pocketBaseConnections.roastedBean),
    );

    if (nextSignature === currentSignature) {
      return;
    }

    setErrors({});

    savePocketBaseConnections({
      ...pocketBaseConnections,
      roastedBean: normalized,
    });

    void syncConnection(normalized);
  };

  const handleFieldChange = (field: ConnectionFieldKey, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));
  };

  const handleClear = () => {
    setDraft(EMPTY_CONNECTION);
    persistDraft(EMPTY_CONNECTION);
  };

  return (
    <article className={styles.card} data-collapsed={isCollapsed}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.titleRow}>
            <h2>熟豆 Supabase 连接</h2>
            <Tag color={statusTagColor}>{statusTagText}</Tag>
          </div>
        </div>
        <Button
          aria-label={isCollapsed ? '展开' : '收起'}
          className={styles.collapseButton}
          data-expanded={!isCollapsed}
          icon={<DownOutlined />}
          onClick={() => {
            setIsCollapsed((current) => !current);
          }}
          type="text"
        />
      </div>

      <div aria-hidden={isCollapsed} className={styles.collapse} data-collapsed={isCollapsed}>
        <div className={styles.collapseInner}>
          <Button
            onClick={handleClear}
            onMouseDown={(event) => {
              event.preventDefault();
            }}
            type="default"
          >
            清空配置
          </Button>

          <div className={styles.fieldGrid}>
            <label className={styles.field} data-field-path="projectUrl" htmlFor="roasted-bean-project-url">
              <span className={styles.fieldLabel}>Supabase URL</span>
              <Input
                id="roasted-bean-project-url"
                onBlur={() => {
                  persistDraft();
                }}
                onChange={(event) => {
                  handleFieldChange('projectUrl', event.target.value);
                }}
                placeholder="https://xxxxx.supabase.co"
                status={errors.projectUrl ? 'error' : undefined}
                value={draft.projectUrl}
              />
            </label>

            <label className={styles.field} data-field-path="publishableKey" htmlFor="roasted-bean-publishable-key">
              <span className={styles.fieldLabel}>Publishable Key</span>
              <Input.Password
                autoComplete="off"
                id="roasted-bean-publishable-key"
                onBlur={() => {
                  persistDraft();
                }}
                onChange={(event) => {
                  handleFieldChange('publishableKey', event.target.value);
                }}
                placeholder="请输入熟豆库的 Publishable Key"
                status={errors.publishableKey ? 'error' : undefined}
                value={draft.publishableKey}
                />
            </label>
          </div>
        </div>
      </div>
    </article>
  );
}
