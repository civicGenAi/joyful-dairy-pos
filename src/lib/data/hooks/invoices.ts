import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoiceKeys, invoicesRepo } from "@/lib/data/invoices";

// BACKEND: react-query wrappers for invoices.

export function useInvoice(id: string | null) {
  return useQuery({
    queryKey: invoiceKeys.byId(id ?? ""),
    queryFn: () => invoicesRepo.byId(id!),
    enabled: !!id,
  });
}

export function useCustomerInvoices(customerId: string | null) {
  return useQuery({
    queryKey: invoiceKeys.byCustomer(customerId ?? ""),
    queryFn: () => invoicesRepo.byCustomer(customerId!),
    enabled: !!customerId,
  });
}

export function useIssueOrderInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ saleId, termsDays }: { saleId: string; termsDays?: number }) =>
      invoicesRepo.issueOrderInvoice(saleId, termsDays),
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: invoiceKeys.byCustomer(invoice.customerId) });
    },
  });
}

export function useIssueBillInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: invoicesRepo.issueBillInvoice,
    onSuccess: (invoice) => {
      qc.invalidateQueries({ queryKey: invoiceKeys.all });
      qc.invalidateQueries({ queryKey: invoiceKeys.byCustomer(invoice.customerId) });
    },
  });
}

/** No auth: this is what the public /verify/$id page calls. */
export function useVerifyInvoice(id: string | null) {
  return useQuery({
    queryKey: ["verify-invoice", id ?? ""],
    queryFn: () => invoicesRepo.verify(id!),
    enabled: !!id,
    retry: false,
  });
}
