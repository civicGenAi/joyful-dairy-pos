import { useQuery } from "@tanstack/react-query";
import { alertsRepo, reportKeys, reportsRepo } from "@/lib/data/reports";

// BACKEND: react-query wrappers for report rollups + computed alerts.

export function useMilkTrend(days = 30) {
  return useQuery({
    queryKey: reportKeys.milkTrend(days),
    queryFn: () => reportsRepo.milkTrend(days),
  });
}

export function useSalesByCategory(from: string, to: string) {
  return useQuery({
    queryKey: reportKeys.salesByCategory(from, to),
    queryFn: () => reportsRepo.salesByCategory(from, to),
  });
}

export function useChannelSplit(from: string, to: string) {
  return useQuery({
    queryKey: reportKeys.channelSplit(from, to),
    queryFn: () => reportsRepo.channelSplit(from, to),
  });
}

export function useTopCustomers(from: string, to: string, limit = 8) {
  return useQuery({
    queryKey: reportKeys.topCustomers(from, to),
    queryFn: () => reportsRepo.topCustomers(from, to, limit),
  });
}

export function useAlerts() {
  return useQuery({
    queryKey: reportKeys.alerts(),
    queryFn: alertsRepo.current,
    refetchInterval: 60_000,
  });
}
