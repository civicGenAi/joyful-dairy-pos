import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { reconKeys, reconRepo } from "@/lib/data/recon";

// BACKEND: react-query wrappers for reconciliation + day locks.

export function useReconForDate(date: string) {
  return useQuery({
    queryKey: reconKeys.forDate(date),
    queryFn: () => reconRepo.forDate(date),
  });
}

export function useDayLock(date: string) {
  return useQuery({
    queryKey: [...reconKeys.locks(), date],
    queryFn: () => reconRepo.lockForDate(date),
  });
}

export function useDayLocks(limit = 14) {
  return useQuery({ queryKey: reconKeys.locks(), queryFn: () => reconRepo.locks(limit) });
}

export function useLockDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      physical,
    }: {
      date: string;
      physical?: { productId: string; closing: number }[];
    }) => reconRepo.lockDay(date, physical),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: reconKeys.all });
      qc.invalidateQueries({ queryKey: ["alerts"] });
    },
  });
}

export function useConfirmDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) => reconRepo.confirmDay(date),
    onSuccess: () => qc.invalidateQueries({ queryKey: reconKeys.all }),
  });
}
