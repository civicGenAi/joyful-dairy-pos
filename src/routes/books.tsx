import { createFileRoute } from "@tanstack/react-router";
import { RequireCap } from "@/components/shell/RequireCap";
import { lazyScreen } from "@/components/shell/lazyScreen";

const BooksScreen = lazyScreen(() => import("@/screens/BooksScreen"), "BooksScreen");

export const Route = createFileRoute("/books")({
  component: () => (
    <RequireCap cap="finance:read">
      <BooksScreen />
    </RequireCap>
  ),
});
