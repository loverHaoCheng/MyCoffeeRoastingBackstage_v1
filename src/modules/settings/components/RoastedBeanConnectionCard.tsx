import { DownOutlined } from '@ant-design/icons';
import { App, Button, Input, Tag } from 'antd';
import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { supabaseConnectionFormSectionSchema } from '@/modules/settings/schemas';
import { brewGuideLinkService, brewGuideUrl } from '@/modules/settings/services/brewGuideLink.service';
import { pocketBaseConnectionRuntimeService } from '@/modules/settings/services/pocketBaseConnectionRuntime.service';
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
const BREW_GUIDE_LINK_COPIED_MESSAGE = '已复制链接，可以到浏览器粘贴展示';
const BREW_GUIDE_LINK_COPY_FAILED_MESSAGE = '链接复制失败，请稍后重试。';

const normalizeConnectionDraft = (
  connection: Partial<PocketBaseProjectConnection> | null | undefined,
): PocketBaseProjectConnection => {
  return normalizeRoastedBeanPocketBaseProjectConnection(connection);
};

const resolveRuntimeConnectionStatus = (
  connection: PocketBaseProjectConnection,
): ConnectionStatus => {
  const cachedStatus = pocketBaseConnectionRuntimeService.readRoastedBeanConnectionStatus(
    connection,
  );

  if (cachedStatus != null) {
    return cachedStatus;
  }

  return hasSyncableRoastedBeanConnection(connection)
    ? 'disconnected'
    : 'unconfigured';
};

export function RoastedBeanConnectionCard() {
  const { message } = App.useApp();
  const pocketBaseConnections = useSettingsStore((state) => state.pocketBaseConnections);
  const savePocketBaseConnections = useSettingsStore((state) => state.savePocketBaseConnections);
  const [draft, setDraft] = useState<PocketBaseProjectConnection>(() =>
    normalizeConnectionDraft(pocketBaseConnections.roastedBean),
  );
  const [errors, setErrors] = useState<Partial<Record<ConnectionFieldKey, string>>>({});
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(() => {
    return resolveRuntimeConnectionStatus(
      normalizeConnectionDraft(pocketBaseConnections.roastedBean),
    );
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
      pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(
        connection,
        'unconfigured',
      );
      setConnectionStatus('unconfigured');
      return;
    }

    pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(
      connection,
      'checking',
    );
    setConnectionStatus('checking');

    try {
      await supabaseConnectionProbeService.verify('roastedBean', connection);
      await supabaseRoastedBeanConnectionSyncService.syncLocalChange(connection);
      pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(
        connection,
        'connected',
      );
      setConnectionStatus('connected');
    } catch {
      pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(
        connection,
        'disconnected',
      );
      setConnectionStatus('disconnected');
    }
  }, []);

  useEffect(() => {
    const currentConnection = normalizeConnectionDraft({
      projectUrl: persistedProjectUrl,
      publishableKey: persistedPublishableKey,
    });

    if (!hasSyncableRoastedBeanConnection(currentConnection)) {
      pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(
        currentConnection,
        'unconfigured',
      );
      setConnectionStatus('unconfigured');
      return;
    }

    const cachedStatus = pocketBaseConnectionRuntimeService.readRoastedBeanConnectionStatus(
      currentConnection,
    );

    if (cachedStatus != null) {
      setConnectionStatus(cachedStatus);
      return;
    }

    pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(
      currentConnection,
      'checking',
    );
    setConnectionStatus('checking');

    void (async () => {
      try {
        await supabaseConnectionProbeService.verify('roastedBean', currentConnection);
        pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(
          currentConnection,
          'connected',
        );
        setConnectionStatus('connected');
      } catch {
        pocketBaseConnectionRuntimeService.saveRoastedBeanConnectionStatus(
          currentConnection,
          'disconnected',
        );
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

  const handleLearnMoreClick = useCallback((event: MouseEvent<HTMLAnchorElement>): void => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    if (!brewGuideLinkService.shouldCopyInCurrentRuntime(window)) {
      return;
    }

    event.preventDefault();

    void (async () => {
      try {
        await brewGuideLinkService.copyUrlToClipboard(document, window.navigator);
        void message.success(BREW_GUIDE_LINK_COPIED_MESSAGE);
      } catch {
        void message.error(BREW_GUIDE_LINK_COPY_FAILED_MESSAGE);
      }
    })();
  }, [message]);

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

          <p className={styles.helpText}>
            熟豆数据将会发送至 Brew Guide 中进行展示。
            <a
              className={styles.helpLink}
              href={brewGuideUrl}
              onClick={handleLearnMoreClick}
              rel="noreferrer"
              target="_blank"
            >
              进一步了解...
            </a>
          </p>
        </div>
      </div>
    </article>
  );
}
