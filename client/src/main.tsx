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
      // In production we usually hit a separate backend domain (e.g. Railway).
      // When VITE_API_BASE_URL is empty, fall back to same-origin (dev mode).
      url: apiBaseUrl 
        ? `${apiBaseUrl.replace(/\/$/, "")}/api/trpc`.replace(/\/{2,}/g, "/")
        : "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // If input is already a full URL (starts with http:// or https://), use it as-is
        // Otherwise, prepend apiBaseUrl if it's set
        let target: RequestInfo | URL;
        if (typeof input === "string") {
          if (input.startsWith("http://") || input.startsWith("https://")) {
            // Already a full URL, use as-is
            target = input;
          } else if (apiBaseUrl) {
            // Relative path, prepend apiBaseUrl
            target = `${apiBaseUrl.replace(/\/$/, "")}${input.startsWith("/") ? input : `/${input}`}`;
          } else {
            // No apiBaseUrl, use relative path
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
