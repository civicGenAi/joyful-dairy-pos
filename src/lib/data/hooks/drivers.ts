import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { driverKeys, driversRepo } from "@/lib/data/drivers";

// BACKEND: react-query wrappers for driver oversight.

export function useDrivers() {
  return useQuery({ queryKey: driverKeys.list(), queryFn: driversRepo.list });
}

export function useDriverStats(id: string | null) {
  return useQuery({
    queryKey: driverKeys.stats(id ?? ""),
    queryFn: () => driversRepo.stats(id!),
    enabled: !!id,
  });
}

export function useDriverCustomers(id: string | null) {
  return useQuery({
    queryKey: driverKeys.customers(id ?? ""),
    queryFn: () => driversRepo.customers(id!),
    enabled: !!id,
  });
}

export function useDriverRoutes(id: string | null) {
  return useQuery({
    queryKey: driverKeys.routes(id ?? ""),
    queryFn: () => driversRepo.routes(id!),
    enabled: !!id,
  });
}

export function useDriverRecentSales(id: string | null) {
  return useQuery({
    queryKey: driverKeys.sales(id ?? ""),
    queryFn: () => driversRepo.recentSales(id!),
    enabled: !!id,
  });
}

export function useDriverRecentDeposits(id: string | null) {
  return useQuery({
    queryKey: driverKeys.deposits(id ?? ""),
    queryFn: () => driversRepo.recentDeposits(id!),
    enabled: !!id,
  });
}

export function useCreateDriver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: driversRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: driverKeys.all }),
  });
}

export function useSetDriverPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      driversRepo.setPassword(id, password),
  });
}

export function useSetDriverActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      driversRepo.setActive(id, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: driverKeys.all }),
  });
}

export function useDriversOverview() {
  return useQuery({ queryKey: driverKeys.overview(), queryFn: driversRepo.overview });
}

export function useDriverDailySales(id: string | null, days = 14) {
  return useQuery({
    queryKey: driverKeys.daily(id ?? "", days),
    queryFn: () => driversRepo.dailySales(id!, days),
    enabled: !!id,
  });
}
