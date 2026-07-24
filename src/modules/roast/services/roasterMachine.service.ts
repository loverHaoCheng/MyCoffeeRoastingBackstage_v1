import { PocketBaseRestClient } from '@/services/pocketBaseRestClient';
import { resolvePocketBaseBaseUrl } from '@/services/pocketBaseConfig';
import { pocketBaseSessionService } from '@/services/pocketBaseSession.service';
import { AppError } from '@/shared/errors/AppError';
import { httpClient } from '@/services/httpClient';

import type { RoasterModel, RoasterModelRecognition, RoastingMachine } from '../types/roasterMachine';

const client = new PocketBaseRestClient({ projectUrl: resolvePocketBaseBaseUrl() });
const roasterModelClient = new PocketBaseRestClient({
  autoManageOwner: false,
  autoManageTimestamps: false,
  projectUrl: resolvePocketBaseBaseUrl(),
});
const asRecord = (value: unknown): Record<string, unknown> => (typeof value === 'object' && value != null ? value as Record<string, unknown> : {});
const text = (value: unknown): string => (typeof value === 'string' ? value : '');

const toModel = (value: unknown): RoasterModel => {
  const item = asRecord(value);
  return { brand: text(item.brand), id: text(item.id), modelName: text(item.model_name), reviewStatus: text(item.review_status) as RoasterModel['reviewStatus'], roastType: text(item.roast_type) as RoasterModel['roastType'], specifications: asRecord(item.specifications) };
};

const toMachine = (value: unknown): RoastingMachine => {
  const item = asRecord(value);
  return { configuration: asRecord(item.configuration), displayName: text(item.display_name), id: text(item.id), modelId: text(item.model_id), modelKey: text(item.model_key), status: text(item.status) as RoastingMachine['status'] };
};

export const roasterMachineService = {
  async createModel(input: RoasterModelRecognition): Promise<RoasterModel> {
    const createdBy = pocketBaseSessionService.getUser()?.id;

    if (!createdBy) {
      throw new AppError('请先登录后再提交烘焙机型号。', { code: 'AUTH' });
    }

    const [created] = await roasterModelClient.insert<Record<string, unknown>>('roaster_models', {
      brand: input.brand,
      created_by: createdBy,
      model_name: input.modelName,
      roast_type: input.roastType,
      review_status: 'pending_review',
      specifications: input.specifications,
    });
    return toModel(created);
  },
  async create(input: Pick<RoastingMachine, 'configuration' | 'displayName' | 'modelId' | 'modelKey'>): Promise<RoastingMachine> {
    const [created] = await client.insert<Record<string, unknown>>('roasting_machines', { configuration: input.configuration, display_name: input.displayName, model_id: input.modelId, model_key: input.modelKey, status: 'active' });
    return toMachine(created);
  },
  async archive(machineId: string): Promise<void> {
    await client.update<Record<string, unknown>>('roasting_machines', { status: 'archived' }, { match: { id: machineId } });
  },
  async listMachines(): Promise<RoastingMachine[]> {
    return (await client.list<Record<string, unknown>>('roasting_machines', { match: { status: 'active' }, orderBy: { column: 'created', ascending: false } })).map(toMachine);
  },
  async listModels(): Promise<RoasterModel[]> {
    return (await roasterModelClient.list<Record<string, unknown>>('roaster_models', { orderBy: { column: 'model_name' } })).map(toModel);
  },
  async recognizeModelImage(imageDataUrl: string): Promise<RoasterModelRecognition> {
    const response = await httpClient.post<RoasterModelRecognition>('/ai/roaster-model-recognition', { imageDataUrl });
    return response.data;
  },
};
