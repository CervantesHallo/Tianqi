import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { setTimeout as scheduleTimer } from "node:timers";

// MockDownstreamServer — a testkit-provided HTTP 1.1 server for External Engine
// adapter tests. Sprint E's business engines (Step 15-17) all point their contract-
// test factories at an instance of this server, wiring
// `ExternalEngineContractOptions` callbacks to the server's fault-injection
// knobs. Extracting this helper to the testkit (instead of copying the Step 14
// version across every business adapter) costs one testkit file and avoids
// duplicating ~150 lines × 5 engines = ~750 lines of identical test scaffolding.
//
// Scope: test-only. Lives under `src/helpers/` (not `src/fixtures/`) because
// fixtures are Reference implementations that drive testkit self-tests, whereas
// helpers are test utilities shared across Adapter packages. Zero third-party
// dependencies — node:http + node:net + node:timers. Port allocation uses :0 so
// parallel test suites on the same host cannot collide.
//
// Business engines opt-in by importing `createMockDownstreamServer` from the
// testkit barrel (see `src/index.ts`).
//
// Injection queue model — the server keeps a FIFO queue of armed faults. A
// caller arms each injection via `nextResponseWillHang()` /
// `nextResponseWillFail()` / `nextResponseDelayed()` / `failNextNThenSucceed()`;
// the handler consumes one injection per inbound request. With no injection
// present the server answers 200 + a tiny JSON body. For the retry contract's
// "fail N, then succeed" pattern the `fail_n_succeed` injection re-queues itself
// with a decremented counter so multiple retries exhaust it correctly.
//
// Extra lever vs Step 14's copy: `nextResponseWillReturnJson()` lets business
// adapter tests drive the "happy-path with a specific body" assertion for
// business-method parsing — something Step 14's base adapter didn't need, but
// business engines (calculate-margin, lock-margin, etc) do.

export type MockDownstreamFault =
  | { readonly kind: "hang" }
  | { readonly kind: "error_retryable" }
  | { readonly kind: "error_non_retry" }
  | { readonly kind: "delayed"; readonly delayMs: number }
  | { readonly kind: "fail_n_succeed"; remaining: number }
  | { readonly kind: "json"; readonly statusCode: number; readonly body: unknown };

export type MockDownstreamServer = {
  readonly url: string;
  readonly nextResponseWillHang: () => void;
  readonly nextResponseWillFail: (retryable: boolean) => void;
  readonly nextResponseDelayed: (delayMs: number) => void;
  readonly failNextNThenSucceed: (n: number) => void;
  readonly nextResponseWillReturnJson: (statusCode: number, body: unknown) => void;
  readonly reset: () => void;
  // Returns the value of a header from the MOST RECENT inbound request (header
  // name is lower-cased per Node's convention). Used by Sprint E tests that
  // verify trace-header propagation or custom auth header injection.
  readonly getLastRequestHeader: (name: string) => string | null;
  // Returns the path (including query string) of the MOST RECENT inbound
  // request. Business engine tests assert the operation-to-path mapping
  // ("calculate-margin" → "/calculate-margin") via this accessor.
  readonly getLastRequestPath: () => string | null;
  // Returns the body of the MOST RECENT inbound request, decoded as UTF-8
  // string. Business engine tests assert request payload serialisation.
  readonly getLastRequestBody: () => string | null;
  readonly close: () => Promise<void>;
};

const writeJson = (res: ServerResponse, statusCode: number, body: unknown): void => {
  res.statusCode = statusCode;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
};

export const createMockDownstreamServer = async (): Promise<MockDownstreamServer> => {
  const injectionQueue: MockDownstreamFault[] = [];
  let lastRequestHeaders: Record<string, string> = {};
  let lastRequestPath: string | null = null;
  let lastRequestBody: string | null = null;
  // Track open sockets so we can destroy hanging connections during close();
  // a "hang" injection leaves its socket open forever otherwise, which would
  // wedge the test's afterAll hook.
  const openSockets = new Set<Socket>();

  const handler = (req: IncomingMessage, res: ServerResponse): void => {
    // Snapshot request metadata at request start. Headers are lower-cased by
    // Node so the getLastRequestHeader accessor can use direct lookups.
    const capturedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") {
        capturedHeaders[key] = value;
      } else if (Array.isArray(value)) {
        capturedHeaders[key] = value.join(",");
      }
    }
    const capturedPath = req.url ?? null;
    const bodyChunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      bodyChunks.push(chunk);
    });
    req.on("end", () => {
      lastRequestHeaders = capturedHeaders;
      lastRequestPath = capturedPath;
      lastRequestBody = Buffer.concat(bodyChunks).toString("utf8");

      const fault = injectionQueue.shift();
      if (fault === undefined) {
        writeJson(res, 200, { ok: true });
        return;
      }
      switch (fault.kind) {
        case "hang":
          // Intentionally never reply; the adapter's request-timeout eventually
          // fires and surfaces as TQ-INF-013.
          return;
        case "error_retryable":
          writeJson(res, 503, { error: "temporarily_unavailable" });
          return;
        case "error_non_retry":
          writeJson(res, 403, { error: "forbidden" });
          return;
        case "delayed":
          scheduleTimer(() => {
            if (!res.writableEnded) writeJson(res, 200, { delayed: fault.delayMs });
          }, fault.delayMs);
          return;
        case "fail_n_succeed":
          if (fault.remaining > 0) {
            injectionQueue.unshift({
              kind: "fail_n_succeed",
              remaining: fault.remaining - 1
            });
            writeJson(res, 503, { error: "transient" });
            return;
          }
          writeJson(res, 200, { recovered: true });
          return;
        case "json":
          writeJson(res, fault.statusCode, fault.body);
          return;
      }
    });
  };

  const server: Server = createServer(handler);
  server.on("connection", (socket: Socket) => {
    openSockets.add(socket);
    socket.on("close", () => {
      openSockets.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("adapter-testkit mock downstream server failed to bind a port");
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
    nextResponseWillReturnJson: (statusCode, body) => {
      injectionQueue.push({ kind: "json", statusCode, body });
    },
    reset: () => {
      injectionQueue.length = 0;
    },
    getLastRequestHeader: (name) => {
      const key = name.toLowerCase();
      const value = lastRequestHeaders[key];
      return value ?? null;
    },
    getLastRequestPath: () => lastRequestPath,
    getLastRequestBody: () => lastRequestBody,
    close: async () => {
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
