import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { setTimeout as scheduleTimer, clearTimeout as clearScheduledTimer } from "node:timers";

// MockDownstreamServer — a minimal HTTP 1.1 server that the External Engine HTTP base
// contract tests point at. Per Step 14 §C design-decision #2 (mock scheme A), the
// Adapter source stays completely free of test-only code paths; fault injection lives
// in THIS helper, which adjusts what the server returns for the next request.
//
// Scope: test-only. This file is located under test/helpers/ (NOT src/) so tsc emits
// no dist artefacts for it. The server implementation uses only node:http + node:timers
// — zero third-party dependencies (§14 no-new-dep discipline). Port allocation uses
// :0 so each test run gets a fresh ephemeral port and cannot collide with another
// test suite on the same host.
//
// Status mapping — what the server returns depends on the injected fault:
//   kind=hang              → connection stays open indefinitely; undici bodyTimeout fires
//   kind=error_retryable   → HTTP 503 (adapter classifies as downstream_unavailable)
//   kind=error_non_retry   → HTTP 403 (adapter classifies as permission_denied)
//   kind=delayed           → delay N ms, then HTTP 200 + small JSON body
//   kind=fail_n_succeed    → the next N requests return 503, then switches to 200
//   (no injection)         → HTTP 200 + small JSON body

export type MockFault =
  | { readonly kind: "hang" }
  | { readonly kind: "error_retryable" }
  | { readonly kind: "error_non_retry" }
  | { readonly kind: "delayed"; readonly delayMs: number }
  | { readonly kind: "fail_n_succeed"; remaining: number };

export type MockDownstreamServer = {
  readonly url: string;
  // Arms the next response. Multiple arms accumulate in a FIFO queue so a test can
  // script "fail, then delay, then succeed" sequences.
  readonly nextResponseWillHang: () => void;
  readonly nextResponseWillFail: (retryable: boolean) => void;
  readonly nextResponseDelayed: (delayMs: number) => void;
  readonly failNextNThenSucceed: (n: number) => void;
  readonly reset: () => void;
  // Returns the header value (lower-cased key) from the MOST RECENT inbound request.
  // Used by the trace-header test to confirm the adapter injected the right value.
  readonly getLastRequestHeader: (name: string) => string | null;
  readonly close: () => Promise<void>;
};

export const startMockDownstreamServer = async (): Promise<MockDownstreamServer> => {
  const injectionQueue: MockFault[] = [];
  let lastRequestHeaders: Record<string, string> = {};
  // Track sockets so we can destroy any hanging connections during close(). Without
  // this, a "hang" fault injection would leave the test run wedged on afterAll.
  const openSockets = new Set<import("node:net").Socket>();

  const writeJsonOk = (res: ServerResponse, body: Record<string, unknown>): void => {
    res.statusCode = 200;
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify(body));
  };

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    // Capture headers as a flat lower-cased map. Node already lower-cases keys for us;
    // we copy into a fresh dict so the test accessor returns a stable snapshot.
    lastRequestHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        lastRequestHeaders[key] = value;
      } else if (Array.isArray(value)) {
        lastRequestHeaders[key] = value.join(",");
      }
    }
    // Drain request body so connection can be reused by keep-alive.
    req.on("data", () => {
      /* discard */
    });
    req.on("end", () => {
      const fault = injectionQueue.shift();
      if (fault === undefined) {
        writeJsonOk(res, { ok: true });
        return;
      }
      switch (fault.kind) {
        case "hang":
          // Intentionally never reply. The adapter's bodyTimeout (headersTimeout
          // actually — we haven't sent headers) fires and surfaces as TQ-INF-013.
          return;
        case "error_retryable":
          res.statusCode = 503;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "temporarily_unavailable" }));
          return;
        case "error_non_retry":
          res.statusCode = 403;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: "forbidden" }));
          return;
        case "delayed":
          scheduleTimer(() => {
            if (!res.writableEnded) writeJsonOk(res, { delayed: fault.delayMs });
          }, fault.delayMs);
          return;
        case "fail_n_succeed":
          if (fault.remaining > 0) {
            injectionQueue.unshift({
              kind: "fail_n_succeed",
              remaining: fault.remaining - 1
            });
            res.statusCode = 503;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ error: "transient" }));
            return;
          }
          writeJsonOk(res, { recovered: true });
          return;
      }
    });
  };

  const server: Server = createServer(handler);
  server.on("connection", (socket) => {
    openSockets.add(socket);
    socket.on("close", () => {
      openSockets.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    // Port :0 → OS picks a free ephemeral port.
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("mock downstream server failed to bind a port");
  }
  const url = `http://127.0.0.1:${address.port}`;

  return {
    url,
    nextResponseWillHang: () => {
      injectionQueue.push({ kind: "hang" });
    },
    nextResponseWillFail: (retryable) => {
      injectionQueue.push({
        kind: retryable ? "error_retryable" : "error_non_retry"
      });
    },
    nextResponseDelayed: (delayMs) => {
      injectionQueue.push({ kind: "delayed", delayMs });
    },
    failNextNThenSucceed: (n) => {
      injectionQueue.push({ kind: "fail_n_succeed", remaining: n });
    },
    reset: () => {
      injectionQueue.length = 0;
    },
    getLastRequestHeader: (name) => {
      const key = name.toLowerCase();
      const value = lastRequestHeaders[key];
      return value ?? null;
    },
    close: async () => {
      // Destroy any sockets that are still open (e.g. pending "hang" responses).
      for (const socket of openSockets) {
        socket.destroy();
      }
      openSockets.clear();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    }
  };
};

export { clearScheduledTimer };
