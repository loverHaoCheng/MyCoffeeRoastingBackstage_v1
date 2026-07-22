export interface RoasterModel {
  brand: string;
  id: string;
  modelName: string;
  reviewStatus: 'approved' | 'pending_review' | 'rejected';
  roastType: 'direct_fire' | 'hot_air' | 'other' | 'semi_hot_air';
  specifications: Record<string, unknown>;
}

export interface RoasterModelRecognition {
  brand: string;
  modelName: string;
  roastType: RoasterModel['roastType'];
  specifications: Record<string, unknown>;
}

export interface RoastingMachine {
  configuration: Record<string, unknown>;
  displayName: string;
  id: string;
  modelId: string;
  modelKey: string;
  status: 'active' | 'archived';
}
