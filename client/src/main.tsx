import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const apiBaseUrlRaw = import.meta.env.VITE_API_BASE_URL ?? "";
const apiBaseUrlTrimmed = apiBaseUrlRaw.trim();
// Ensure apiBaseUrl starts with http:// or https://
const apiBaseUrl = apiBaseUrlTrimmed && !apiBaseUrlTrimmed.startsWith("http://") && !apiBaseUrlTrimmed.startsWith("https://")
  ? `https://${apiBaseUrlTrimmed}`
  : apiBaseUrlTrimmed;

// Debug: Log API base URL (only in development or if not set)
if (import.meta.env.DEV || !apiBaseUrl) {
  console.log("[tRPC] VITE_API_BASE_URL raw:", apiBaseUrlRaw);
  console.log("[tRPC] VITE_API_BASE_URL processed:", apiBaseUrl);
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      // Always use relative path for url - httpBatchLink will call fetch with this path
      // We'll prepend apiBaseUrl in the fetch function if needed
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // input is always a relative path from httpBatchLink
        // Prepend apiBaseUrl if it's set, otherwise use relative path
        let target: RequestInfo | URL;
        if (typeof input === "string") {
          if (apiBaseUrl) {
            // Prepend apiBaseUrl to relative path
            const cleanBaseUrl = apiBaseUrl.replace(/\/$/, "");
            const cleanPath = input.startsWith("/") ? input : `/${input}`;
            target = `${cleanBaseUrl}${cleanPath}`;
          } else {
            // No apiBaseUrl, use relative path as-is
            target = input;
          }
        } else {
          target = input;
        }
        return globalThis.fetch(target, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);
