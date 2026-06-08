import { createFileRoute } from "@tanstack/react-router";
import { FarmerPayoutSlipScreen } from "@/screens/PrintLayouts";
import { RequireCap } from "@/components/shell/RequireCap";
import { z } from "zod";

const searchSchema = z.object({
  cycle: z.string().optional(),
});

export const Route = createFileRoute("/payout/farmer/$id")({
  head: () => ({ meta: [{ title: "Farmer payout slip, African Joy Dairy" }] }),
  validateSearch: searchSchema,
  component: () => (
    <RequireCap cap={["farmers:read", "payout:write"]}>
      <FarmerPayoutSlipScreen />
    </RequireCap>
  ),
});
