import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppProvider } from "@/app/context";
import { Toaster } from "@/components/ui/sonner";
import { NotFoundScreen, GenericErrorScreen } from "@/screens/UtilityScreens";
import { CommandPalette } from "@/components/shell/CommandPalette";

function NotFoundComponent() {
  // Boundary components render outside RootComponent, so they need their own
  // AppProvider for useApp() (translator, theme) to work.
  return (
    <AppProvider>
      <NotFoundScreen />
    </AppProvider>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <AppProvider>
      <GenericErrorScreen
        error={error}
        reset={() => {
          router.invalidate();
          reset();
        }}
      />
    </AppProvider>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "African Joy Dairy, Operations" },
      { name: "description", content: "Operations and POS for African Joy Dairy, Arusha." },
      // Internal system: keep it out of every search engine, archive and snippet.
      {
        name: "robots",
        content: "noindex, nofollow, noarchive, nosnippet, noimageindex, nocache",
      },
      { name: "googlebot", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
    links: [
      { rel: "icon", href: "/favicon_io/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon_io/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon_io/favicon-16x16.png" },
      { rel: "apple-touch-icon", href: "/favicon_io/apple-touch-icon.png" },
      { rel: "manifest", href: "/favicon_io/site.webmanifest" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Outlet />
        <CommandPalette />
        <Toaster position="top-right" richColors />
      </AppProvider>
    </QueryClientProvider>
  );
}
