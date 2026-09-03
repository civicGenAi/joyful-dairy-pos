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
