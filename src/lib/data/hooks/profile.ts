import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { profileKeys, profileRepo } from "@/lib/data/profile";
import { alertReadsRepo, reportKeys } from "@/lib/data/reports";
import { useApp } from "@/app/context";

// BACKEND: react-query wrappers for the self-service profile + notifications.

export function useUpdateOwnProfile() {
  const { refreshUser } = useApp();
  return useMutation({
    mutationFn: profileRepo.updateOwn,
    onSuccess: () => refreshUser(),
  });
}

export function useUploadAvatar() {
  const { refreshUser } = useApp();
  return useMutation({
    mutationFn: (file: File) => profileRepo.uploadAvatar(file),
    onSuccess: () => refreshUser(),
  });
}

export function useChangeOwnPassword() {
  return useMutation({
    mutationFn: ({
      email,
      oldPassword,
      newPassword,
    }: {
      email: string;
      oldPassword: string;
      newPassword: string;
    }) => profileRepo.changeOwnPassword(email, oldPassword, newPassword),
  });
}

export function useSessions() {
  return useQuery({ queryKey: profileKeys.sessions(), queryFn: profileRepo.sessions });
}

export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profileRepo.revokeSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.sessions() }),
  });
}

export function useSignOutOtherDevices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: profileRepo.signOutOtherDevices,
    onSuccess: () => qc.invalidateQueries({ queryKey: profileKeys.sessions() }),
  });
}

// --- Notification read-state -------------------------------------------------

export function useAlertReads() {
  return useQuery({
    queryKey: [...reportKeys.alerts(), "reads"],
    queryFn: alertReadsRepo.list,
  });
}

export function useMarkAlertsRead() {
  const { user } = useApp();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (alertIds: string[]) => alertReadsRepo.markRead(user?.id ?? "", alertIds),
    onSuccess: () => qc.invalidateQueries({ queryKey: [...reportKeys.alerts(), "reads"] }),
  });
}
