export type BackupRecord = Record<string, unknown>;

export type BackupCollectionName =
  | 'green_beans'
  | 'green_bean_purchase_batches'
  | 'bean_sale_specs'
  | 'roasting_machines'
  | 'roast_profiles'
  | 'roast_batches'
  | 'roast_curve_records'
  | 'roast_records'
  | 'ai_roast_consents'
  | 'ai_roast_profiles'
  | 'ai_roast_reviews'
  | 'ai_roast_recommendations'
  | 'ai_roast_feedback'
  | 'ai_roast_conversations'
  | 'ai_roast_messages'
  | 'ai_analysis_tasks'
  | 'finance_expense_records'
  | 'finance_income_records'
  | 'cost_calculations'
  | 'app_settings';

export type BackupIdMaps = Partial<Record<BackupCollectionName, Map<string, string>>>;

export interface BackupImportContext {
  roasterModelLabels: Map<string, string>;
}

export type BackupImportMode = 'merge-account' | 'same-account';

export type UserDataBackupImportStrategy = 'merge' | 'sync';

export interface UserDataBackupFile {
  collections: Partial<Record<BackupCollectionName, BackupRecord[]>>;
  exportedBy?: {
    email?: string;
    id: string;
  };
  exportedAt: string;
  schema: string;
  summary: Partial<Record<BackupCollectionName, number>>;
  version: number;
}

export interface UserDataBackupImportResult {
  deleted: number;
  imported: number;
  skipped: number;
  updated: number;
}

export interface UserDataBackupImportOptions {
  strategy?: UserDataBackupImportStrategy;
}
