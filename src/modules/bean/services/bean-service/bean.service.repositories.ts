import { pocketBaseConnectionSettingsService } from '@/modules/settings/services/pocketBaseConnectionSettings.service';
import { isPocketBaseProjectConnectionConfigured } from '@/modules/settings/types';
import { logger } from '@/shared/logger/logger';
import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';

import { createGreenBeanInventoryRepository } from './bean.service.inventory-repository';
import { MockBeanRepository } from './bean.service.mock-repository';
import { createRemoteBeanRepository } from './bean.service.remote-repository';
import type { BeanRepository } from './bean.service.types';

const hasGreenBeanConnection = (): boolean => {
  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');

  return isPocketBaseProjectConnectionConfigured(connection);
};

export { createGreenBeanInventoryRepository, MockBeanRepository, createRemoteBeanRepository };

export const resolveBeanRepository = (): BeanRepository => {
  if (import.meta.env.MODE === 'test') {
    logger.info('bean repository: mock (test mode)');
    return new MockBeanRepository();
  }

  if (!hasGreenBeanConnection()) {
    logger.info('bean repository: mock (missing connection)');
    return new MockBeanRepository();
  }

  const connection = pocketBaseConnectionSettingsService.resolveProjectConnection('greenBean');
  const client = new PocketBaseRestClient({
    projectUrl: connection.projectUrl,
    publishableKey: connection.publishableKey,
  });

  logger.info('bean repository: remote', {
    projectUrl: connection.projectUrl,
  });
  return createGreenBeanInventoryRepository(client);
};
