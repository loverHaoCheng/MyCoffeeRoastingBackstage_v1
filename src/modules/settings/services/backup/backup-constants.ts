import type { BackupCollectionName } from './backup-types';

export const BACKUP_SCHEMA = 'easybake.user-data-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_BACKUP_RECORDS_PER_COLLECTION = 10_000;
export const MAX_BACKUP_RECORDS_TOTAL = 50_000;

export const backupCollections: readonly BackupCollectionName[] = [
  'green_beans',
  'green_bean_purchase_batches',
  'bean_sale_specs',
  'roasting_machines',
  'roast_profiles',
  'roast_batches',
  'roast_curve_records',
  'roast_records',
  'ai_roast_consents',
  'ai_roast_profiles',
  'ai_roast_reviews',
  'ai_roast_recommendations',
  'ai_roast_feedback',
  'ai_roast_conversations',
  'ai_roast_messages',
  'ai_analysis_tasks',
  'finance_expense_records',
  'finance_income_records',
  'cost_calculations',
  'app_settings',
];

export const optionalBackupCollections = new Set<BackupCollectionName>([
  'ai_roast_consents',
  'ai_roast_feedback',
  'ai_roast_profiles',
  'ai_roast_recommendations',
  'ai_roast_reviews',
  'ai_roast_conversations',
  'ai_roast_messages',
  'ai_analysis_tasks',
  'app_settings',
  'bean_sale_specs',
  'cost_calculations',
  'finance_expense_records',
  'finance_income_records',
  'green_bean_purchase_batches',
  'roast_curve_records',
  'roast_records',
  'roasting_machines',
]);

export const importOmittedFields = new Set([
  'collectionId',
  'collectionName',
  'created',
  'created_at',
  'expand',
  'owner',
  'updated',
  'updated_at',
]);

export const relationFieldMappings: Partial<Record<BackupCollectionName, Partial<Record<string, BackupCollectionName>>>> = {
  app_settings: {},
  bean_sale_specs: {
    green_bean_id: 'green_beans',
  },
  cost_calculations: {
    bean_id: 'green_beans',
  },
  green_bean_purchase_batches: {
    green_bean_id: 'green_beans',
  },
  roast_batches: {
    green_bean_id: 'green_beans',
    roast_plan_id: 'roast_profiles',
  },
  roast_curve_records: {
    roast_batch_id: 'roast_batches',
  },
  roast_profiles: {
    green_bean_id: 'green_beans',
    roaster_machine_id: 'roasting_machines',
  },
  roast_records: {
    green_bean_id: 'green_beans',
  },
  ai_roast_consents: {
    machine_id: 'roasting_machines',
  },
  ai_roast_feedback: {
    recommendation_id: 'ai_roast_recommendations',
    roast_batch_id: 'roast_batches',
  },
  ai_roast_profiles: {
    machine_id: 'roasting_machines',
  },
  ai_roast_recommendations: {
    machine_id: 'roasting_machines',
  },
  ai_roast_reviews: {
    curve_record_id: 'roast_curve_records',
    machine_id: 'roasting_machines',
    roast_batch_id: 'roast_batches',
  },
  ai_roast_conversations: {
    green_bean_id: 'green_beans',
    roast_batch_id: 'roast_batches',
  },
  ai_roast_messages: {
    conversation_id: 'ai_roast_conversations',
  },
  ai_analysis_tasks: {
    roast_batch_id: 'roast_batches',
  },
};

export const clearWhenRelationTargetMissing = new Set<string>([
  'ai_roast_consents.machine_id',
  'ai_roast_feedback.recommendation_id',
  'ai_roast_feedback.roast_batch_id',
  'ai_roast_profiles.machine_id',
  'ai_roast_recommendations.machine_id',
  'ai_roast_reviews.curve_record_id',
  'ai_roast_reviews.machine_id',
  'ai_roast_reviews.roast_batch_id',
  'ai_roast_conversations.green_bean_id',
  'ai_roast_conversations.roast_batch_id',
  'ai_roast_messages.conversation_id',
  'ai_analysis_tasks.roast_batch_id',
  'roast_profiles.roaster_machine_id',
]);

export const appSettingIdKeyPrefixes: {
  collectionName: BackupCollectionName;
  prefix: string;
}[] = [
  { collectionName: 'green_beans', prefix: 'green_bean_sale_defaults:' },
  { collectionName: 'green_beans', prefix: 'green_bean_cost_template:' },
  { collectionName: 'green_beans', prefix: 'green_bean_grade:' },
];
