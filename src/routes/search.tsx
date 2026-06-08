import { createFileRoute } from "@tanstack/react-router";
import { lazyScreen } from "@/components/shell/lazyScreen";
import { z } from "zod";

const SearchScreen = lazyScreen(() => import("@/screens/SearchScreen"), "SearchScreen");

const searchSchema = z.object({
  q: z.string().optional(),
});

export const Route = createFileRoute("/search")({
  validateSearch: searchSchema,
  component: SearchScreen,
});
