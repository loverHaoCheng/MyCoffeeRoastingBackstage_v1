import { PocketBaseRestClient } from '@/shared/services/pocketBaseRestClient';

export interface FinanceLedgerConnectionCandidate {
  client: Pick<PocketBaseRestClient, 'delete' | 'insert' | 'list'>;
}

export const resolveLedgerConnectionCandidates = (): FinanceLedgerConnectionCandidate[] => {
  return [{
    client: new PocketBaseRestClient({
      projectUrl: '',
      publishableKey: '',
    }),
  }];
};
