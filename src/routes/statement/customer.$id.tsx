import { createFileRoute } from "@tanstack/react-router";
import { CustomerStatementPrintScreen } from "@/screens/PrintLayouts";
import { RequireCap } from "@/components/shell/RequireCap";
import { z } from "zod";

const searchSchema = z.object({
  month: z.string().optional(),
});

export const Route = createFileRoute("/statement/customer/$id")({
  head: () => ({ meta: [{ title: "Customer statement, African Joy Dairy" }] }),
  validateSearch: searchSchema,
  component: () => <RequireCap cap="customers:read"><CustomerStatementPrintScreen /></RequireCap>,
});
