import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { companyRepo, settingsKeys, usersRepo } from "@/lib/data/settings";
import { auditKeys, auditRepo } from "@/lib/data/audit";
import type { Role } from "@/mock/types";

// BACKEND: react-query wrappers for users, company settings and the audit log.

export function useUsers() {
  return useQuery({ queryKey: settingsKeys.users(), queryFn: usersRepo.list });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersRepo.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

export function useSetUserRoles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, roles }: { id: string; name: string; roles: Role[] }) =>
      usersRepo.setRoles(id, name, roles),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

export function useSetUserActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name, active }: { id: string; name: string; active: boolean }) =>
      usersRepo.setActive(id, name, active),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

export function useSetUserPassword() {
  return useMutation({
    mutationFn: ({ id, password }: { id: string; password: string }) =>
      usersRepo.setPassword(id, password),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; name: string }) => usersRepo.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.all }),
  });
}

export function useCompany() {
  return useQuery({ queryKey: settingsKeys.company(), queryFn: companyRepo.get });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: companyRepo.update,
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.company() }),
  });
}

export function useAuditLog(limit = 100) {
  return useQuery({ queryKey: auditKeys.list(limit), queryFn: () => auditRepo.list(limit) });
}
