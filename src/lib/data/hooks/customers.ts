import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerExtrasRepo, customerKeys, customersRepo } from "@/lib/data/customers";

// BACKEND: react-query wrappers for customers, activities and deposits.

export function useCustomers() {
  return useQuery({ queryKey: customerKeys.list(), queryFn: customersRepo.list });
}

export function useCustomer(id: string | null) {
  return useQuery({
    queryKey: customerKeys.byId(id ?? ""),
    queryFn: () => customersRepo.byId(id!),
    enabled: !!id,
  });
}

export function useCustomerActivities(id: string | null) {
  return useQuery({
    queryKey: customerKeys.activities(id ?? ""),
    queryFn: () => customersRepo.activities(id!),
    enabled: !!id,
  });
}

export function useCustomerDeposits(id: string | null) {
  return useQuery({
    queryKey: customerKeys.deposits(id ?? ""),
    queryFn: () => customersRepo.deposits(id!),
    enabled: !!id,
  });
}

export function useCreateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: customersRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useUpdateCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: customersRepo.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useDeleteCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => customersRepo.remove(id, name),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useRecordCustomerDeposit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: customersRepo.recordDeposit,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: customerKeys.all });
      qc.invalidateQueries({ queryKey: ["deposits"] });
      qc.invalidateQueries({ queryKey: ["finance"] });
    },
  });
}

export function useSetCustomerSuspended() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, suspended }: { id: string; name: string; suspended: boolean }) =>
      customerExtrasRepo.setSuspended(id, name, suspended),
    onSuccess: () => qc.invalidateQueries({ queryKey: customerKeys.all }),
  });
}

export function useSendReminder() {
  return useMutation({
    mutationFn: (customerId?: string) => customerExtrasRepo.sendReminder(customerId),
  });
}
