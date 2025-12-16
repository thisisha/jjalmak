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
        // httpBatchLink may pass either a relative path or a full URL
        // Check if input is already a full URL (starts with http:// or https://)
        let target: RequestInfo | URL;
        if (typeof input === "string") {
          if (input.startsWith("http://") || input.startsWith("https://")) {
            // Already a full URL, use as-is (but check for double prefix)
            // Sometimes httpBatchLink creates URLs like "https://base/https://base/path"
            // We need to detect and fix this
            if (input.includes("https://") && input.split("https://").length > 2) {
              // Remove the duplicate prefix
              const parts = input.split("https://");
              target = `https://${parts[parts.length - 1]}`;
            } else if (input.includes("http://") && input.split("http://").length > 2) {
              const parts = input.split("http://");
              target = `http://${parts[parts.length - 1]}`;
            } else {
              target = input;
            }
          } else if (apiBaseUrl) {
            // Relative path, prepend apiBaseUrl
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
