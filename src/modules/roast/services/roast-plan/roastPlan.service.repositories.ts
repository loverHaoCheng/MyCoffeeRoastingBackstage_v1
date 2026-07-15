import { AppError } from '@/shared/errors/AppError';
import type { RoastPlan } from '@/types/domain';

import {
  createRoastPlan,
  createRoastPlanFromJson,
  updateRoastPlanFromInput,
} from '../roastPlanJson.service';
import type { RoastPlanJsonInput } from '../../types';
import {
  getGreenBeanClient,
  getRoastPlanById,
  hasGreenBeanConnection,
  mapRemoteRoastPlanRecord,
  ok,
  toRemoteRoastPlanPayload,
} from './roastPlan.service.shared';
import {
  createOptimisticLocalPlanId,
  getPlanSyncSnapshot,
  isOptimisticLocalPlanId,
  roastPlanState,
  saveLocalPlans,
  sortPlans,
} from './roastPlan.service.state';
import type {
  RemoteRoastBatchPlanRelationRecord,
  RemoteRoastPlanOverviewRecord,
  RemoteRoastProfileMutationRecord,
  RoastPlanRepository,
} from './roastPlan.service.types';

class LocalRoastPlanRepository implements RoastPlanRepository {
  createPlan(input: RoastPlanJsonInput) {
    const nextId = Math.max(
      0,
      ...roastPlanState.localPlans.map((plan) => (typeof plan.id === 'number' ? plan.id : 0)),
    ) + 1;
    const plan = createRoastPlan(input, nextId);

    roastPlanState.localPlans = saveLocalPlans([plan, ...roastPlanState.localPlans]);

    return Promise.resolve(ok(plan));
  }

  createPlanFromJson(jsonText: string) {
    const nextId = Math.max(
      0,
      ...roastPlanState.localPlans.map((plan) => (typeof plan.id === 'number' ? plan.id : 0)),
    ) + 1;
    const plan = createRoastPlanFromJson(jsonText, nextId);

    roastPlanState.localPlans = saveLocalPlans([plan, ...roastPlanState.localPlans]);

    return Promise.resolve(ok(plan));
  }

  deletePlan(planId: RoastPlan['id']) {
    roastPlanState.localPlans = saveLocalPlans(
      roastPlanState.localPlans.filter((plan) => String(plan.id) !== String(planId)),
    );

    return Promise.resolve(ok(null));
  }

  listPlans() {
    return Promise.resolve(ok(sortPlans(roastPlanState.localPlans)));
  }

  updatePlan(planId: RoastPlan['id'], input: RoastPlanJsonInput) {
    const currentPlan = roastPlanState.localPlans.find((plan) => String(plan.id) === String(planId));

    if (!currentPlan) {
      throw new AppError('烘焙计划不存在', {
        code: 'BUSINESS',
      });
    }

    const nextPlan = updateRoastPlanFromInput(currentPlan, input);

    roastPlanState.localPlans = saveLocalPlans(
      roastPlanState.localPlans.map((plan) => (String(plan.id) === String(planId) ? nextPlan : plan)),
    );

    return Promise.resolve(ok(nextPlan));
  }
}

class RemoteRoastPlanRepository implements RoastPlanRepository {
  constructor(private readonly client = getGreenBeanClient()) {}

  async createPlan(input: RoastPlanJsonInput) {
    const insertedRows = await this.client.insert<RemoteRoastProfileMutationRecord>(
      'roast_profiles',
      await toRemoteRoastPlanPayload(this.client, input),
      {
        select: 'id',
      },
    );

    const insertedRecord = insertedRows[0];

    if (!insertedRecord) {
      throw new AppError('烘焙计划创建成功，但未返回新记录。', {
        code: 'DATA',
      });
    }

    return ok(await getRoastPlanById(this.client, insertedRecord.id));
  }

  async createPlanFromJson(jsonText: string) {
    const draftPlan = createRoastPlanFromJson(jsonText, 0);

    return this.createPlan({
      batchWeightGrams: draftPlan.batchWeightGrams,
      beanId: draftPlan.beanId,
      beanName: draftPlan.beanName,
      name: draftPlan.name,
      roasterModel: draftPlan.roasterModel,
      purpose: draftPlan.roastPurpose,
      roastLevel: draftPlan.targetRoastLevel,
      steps: draftPlan.steps.map((step) => ({
        airTemperature: step.airTemperature,
        drumSpeed: step.drumSpeed,
        event: step.eventName,
        firePower: step.firePower,
        note: step.note,
        operation: step.operation,
        temperature: step.drumTemperature,
        time: step.timeLabel,
      })),
    });
  }

  async deletePlan(planId: RoastPlan['id']) {
    const linkedBatches = await this.client.list<RemoteRoastBatchPlanRelationRecord>('roast_batches', {
      match: {
        roast_plan_id: String(planId),
      },
      select: 'id',
    });

    await Promise.all(
      linkedBatches.map((batch) =>
        this.client.update<RemoteRoastBatchPlanRelationRecord>(
          'roast_batches',
          {
            roast_plan_id: null,
            roast_plan_name: null,
          },
          {
            match: { id: batch.id },
            select: 'id',
          },
        ),
      ),
    );

    await this.client.delete('roast_profiles', {
      match: {
        id: String(planId),
      },
    });

    return ok(null);
  }

  async listPlans() {
    const records = await this.client.list<RemoteRoastPlanOverviewRecord>('roast_plan_overview', {
      orderBy: {
        ascending: false,
        column: 'updated_at',
      },
    });

    return ok(records.map(mapRemoteRoastPlanRecord));
  }

  async updatePlan(planId: RoastPlan['id'], input: RoastPlanJsonInput) {
    const currentPlan = await getRoastPlanById(this.client, planId);

    const updatedRows = await this.client.update<RemoteRoastProfileMutationRecord>(
      'roast_profiles',
      await toRemoteRoastPlanPayload(this.client, input, currentPlan.status),
      {
        match: {
          id: String(planId),
        },
        select: 'id',
      },
    );

    const updatedRecord = updatedRows[0];

    if (!updatedRecord) {
      throw new AppError('烘焙计划更新成功，但未返回结果。', {
        code: 'DATA',
      });
    }

    return ok(await getRoastPlanById(this.client, updatedRecord.id));
  }
}

export const resolveRoastPlanRepository = (): RoastPlanRepository => {
  if (import.meta.env.MODE === 'test') {
    return new LocalRoastPlanRepository();
  }

  if (!hasGreenBeanConnection()) {
    return new LocalRoastPlanRepository();
  }

  return new RemoteRoastPlanRepository();
};

export const roastPlanOptimisticHelpers = {
  createOptimisticPlan(input: RoastPlanJsonInput): RoastPlan {
    const plan = createRoastPlan(input, 0);
    const optimisticPlan: RoastPlan = {
      ...plan,
      id: createOptimisticLocalPlanId(),
      updatedAt: new Date().toISOString(),
    };

    roastPlanState.pendingOptimisticCreatePlanIds.add(String(optimisticPlan.id));
    roastPlanState.localPlans = saveLocalPlans([optimisticPlan, ...roastPlanState.localPlans]);

    return optimisticPlan;
  },
  createOptimisticPlanFromJson(jsonText: string): RoastPlan {
    const plan = createRoastPlanFromJson(jsonText, 0);
    const optimisticPlan: RoastPlan = {
      ...plan,
      id: createOptimisticLocalPlanId(),
      updatedAt: new Date().toISOString(),
    };

    roastPlanState.pendingOptimisticCreatePlanIds.add(String(optimisticPlan.id));
    roastPlanState.localPlans = saveLocalPlans([optimisticPlan, ...roastPlanState.localPlans]);

    return optimisticPlan;
  },
  syncLocalAndRemote: async (): Promise<{ downloaded: number; uploaded: number }> => {
    if (!hasGreenBeanConnection() || typeof navigator === 'undefined' || !navigator.onLine) {
      return { downloaded: 0, uploaded: 0 };
    }

    if (
      roastPlanState.pendingOptimisticCreatePlanIds.size > 0 ||
      roastPlanState.pendingOptimisticDeletePlanIds.size > 0
    ) {
      return { downloaded: 0, uploaded: 0 };
    }

    const repository = new RemoteRoastPlanRepository();
    const localPlansBeforeSync = sortPlans(roastPlanState.localPlans);
    const optimisticLocalPlans = localPlansBeforeSync.filter((plan) => isOptimisticLocalPlanId(plan.id));
    const remotePlans = await repository.listPlans();
    const visibleRemotePlans = remotePlans.data.filter(
      (plan) => !roastPlanState.pendingOptimisticDeletePlanIds.has(String(plan.id)),
    );
    const nextPlans = sortPlans([...optimisticLocalPlans, ...visibleRemotePlans]);
    const beforeSignature = getPlanSyncSnapshot(localPlansBeforeSync);
    const afterSignature = getPlanSyncSnapshot(nextPlans);

    roastPlanState.localPlans = saveLocalPlans(nextPlans);

    return {
      downloaded: beforeSignature === afterSignature ? 0 : nextPlans.length,
      uploaded: 0,
    };
  },
};
