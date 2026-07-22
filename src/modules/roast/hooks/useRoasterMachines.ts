import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { roasterMachineService } from '../services/roasterMachine.service';
import type { RoasterModelRecognition, RoastingMachine } from '../types/roasterMachine';

export const roasterMachineQueryKeys = { all: ['roaster-machines'] as const, machines: () => [...roasterMachineQueryKeys.all, 'machines'] as const, models: () => [...roasterMachineQueryKeys.all, 'models'] as const };
export const useRoasterModels = () => useQuery({ queryKey: roasterMachineQueryKeys.models(), queryFn: () => roasterMachineService.listModels() });
export const useRoastingMachines = () => useQuery({ queryKey: roasterMachineQueryKeys.machines(), queryFn: () => roasterMachineService.listMachines() });
export function useCreateRoastingMachine() { const queryClient = useQueryClient(); return useMutation({ mutationFn: (input: Pick<RoastingMachine, 'configuration' | 'displayName' | 'modelId' | 'modelKey'>) => roasterMachineService.create(input), onSuccess: () => queryClient.invalidateQueries({ queryKey: roasterMachineQueryKeys.machines() }) }); }
export function useCreateRoasterModel() { const queryClient = useQueryClient(); return useMutation({ mutationFn: (input: RoasterModelRecognition) => roasterMachineService.createModel(input), onSuccess: () => queryClient.invalidateQueries({ queryKey: roasterMachineQueryKeys.models() }) }); }
