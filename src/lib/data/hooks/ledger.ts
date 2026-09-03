import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ledgerKeys, ledgerRepo } from "@/lib/data/ledger";

// BACKEND: react-query wrappers for the general ledger.

export function useTrialBalance(from: string, to: string) {
  return useQuery({
    queryKey: ledgerKeys.trial(from, to),
    queryFn: () => ledgerRepo.trialBalance(from, to),
  });
}

export function useProfitLoss(from: string, to: string) {
  return useQuery({
    queryKey: ledgerKeys.pl(from, to),
    queryFn: () => ledgerRepo.profitLoss(from, to),
  });
}

export function useBalanceSheet(asAt: string) {
  return useQuery({ queryKey: ledgerKeys.bs(asAt), queryFn: () => ledgerRepo.balanceSheet(asAt) });
}

export function useVatReturn(from: string, to: string) {
  return useQuery({
    queryKey: ledgerKeys.vat(from, to),
    queryFn: () => ledgerRepo.vatReturn(from, to),
  });
}

export function usePostLedger() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) => ledgerRepo.post(from, to),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}

export function useOpeningBalances() {
  return useQuery({ queryKey: ledgerKeys.opening(), queryFn: ledgerRepo.openingBalances });
}

export function useSuggestedOpening() {
  return useQuery({ queryKey: ledgerKeys.suggested(), queryFn: ledgerRepo.suggestedOpening });
}

export function useSetOpeningBalances() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, lines }: { date: string; lines: { account: string; amount: number }[] }) =>
      ledgerRepo.setOpeningBalances(date, lines),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}

export function useCashFlow(from: string, to: string) {
  return useQuery({
    queryKey: ledgerKeys.cashFlow(from, to),
    queryFn: () => ledgerRepo.cashFlow(from, to),
  });
}

export function usePostingStatus() {
  return useQuery({ queryKey: ledgerKeys.status(), queryFn: ledgerRepo.postingStatus });
}

export function useLockedPeriods() {
  return useQuery({ queryKey: ledgerKeys.locks(), queryFn: ledgerRepo.lockedPeriods });
}

export function useLockPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ period, note }: { period: string; note?: string }) =>
      ledgerRepo.lockPeriod(period, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}

export function useUnlockPeriod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ period, reason }: { period: string; reason: string }) =>
      ledgerRepo.unlockPeriod(period, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}

export function useBankRecLines(account: string, asAt: string) {
  return useQuery({
    queryKey: ledgerKeys.bankRec(account, asAt),
    queryFn: async () => ({
      lines: await ledgerRepo.bankRecLines(account, asAt),
      summary: await ledgerRepo.bankRecSummary(account, asAt),
    }),
  });
}

export function useManualEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      date,
      memo,
      lines,
    }: {
      date: string;
      memo: string;
      lines: { account: string; debit: number; credit: number; memo?: string }[];
    }) => ledgerRepo.manualEntry(date, memo, lines),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}

export function useSetCleared() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ lineIds, cleared }: { lineIds: string[]; cleared: boolean }) =>
      ledgerRepo.setCleared(lineIds, cleared),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}

export function useCloseBankRec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      account,
      statementDate,
      statementBalance,
      note,
    }: {
      account: string;
      statementDate: string;
      statementBalance: number;
      note?: string;
    }) => ledgerRepo.closeBankRec(account, statementDate, statementBalance, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: ledgerKeys.all }),
  });
}
