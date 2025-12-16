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

const apiBaseUrlRaw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
// Ensure apiBaseUrl starts with http:// or https://
const apiBaseUrl = apiBaseUrlRaw && !apiBaseUrlRaw.startsWith("http://") && !apiBaseUrlRaw.startsWith("https://")
  ? `https://${apiBaseUrlRaw}`
  : apiBaseUrlRaw;

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
        const target =
          apiBaseUrl && typeof input === "string"
            ? `${apiBaseUrl.replace(/\/$/, "")}${input}`
            : input;
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
