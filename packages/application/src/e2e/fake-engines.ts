// Phase 11 / Step 2 — fake-engines.ts：假外部引擎 HTTP server helper.
//
// 用途（裁决 3 α；ADR-0004 Step 2 段）：
// 让 createE2eHarness 配合 5 个 Engine HTTP adapter（margin/position/match/
// mark-price/fund）真实激活——按 《§8.1》"假引擎可接受 HTTP 协议"约束，
// 不调用真实外部交易引擎，但走真实 HTTP wire path（adapter 真实 init、
// 真实 fetch 调用、真实 JSON 解析）。
//
// 设计原则：
//   - **Node.js 内置 http 模块**（元规则 P 严守 32 步零依赖；不引入
//     express/fastify/koa 等 HTTP 框架）
//   - **单 server 多路径分发**：5 engine adapter 全部 baseUrl 指向同一
//     fake server URL；server 按 `req.url` path 分发到对应 happy-path
//     响应。简化端口管理 + 测试 setup。
//   - **happy path only**：v1 仅支持 Liquidation 顺利路径需要的 5 endpoint
//     （query-mark-price / list-open-positions / place-order / release-margin
//     / transfer-fund）。失败路径推迟 Step 4-6（补偿 / 死信 / 恢复）。
//   - **可观测请求日志**：暴露 receivedRequests 让测试断言"每个 step 真实
//     发出 HTTP call"，验证 §15 审计要求 + §8.1 真实激活语义。
//   - **port :0 自动分配**：parallel 测试套件不冲突。
//
// 与既有 mock-downstream-server.ts (adapter-testkit) 的关系：
//   - mock-downstream-server: 单 adapter 测试用；路径无关；fault injection
//     队列模型
//   - fake-engines: e2e 测试用；路径敏感；happy-path 多 endpoint 真实业务
//     响应；面向 Saga 编排端到端语义
//   - 不复用 mock-downstream-server 因为它的设计目标不同（fault injection
//     vs happy-path business response）
//
// Phase 11+ 演进预留：
//   - Step 3 (ADL) 可能扩展 endpoint 集合（adjust-position / 等）
//   - Step 4-6 补偿 / 死信 / 恢复路径可能需要按 caseId 选择性失败注入
//     （新增可选 faultInjection config；不破坏 v1 API）

import { Buffer } from "node:buffer";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Socket } from "node:net";

/**
 * 单次 fake server 收到的 HTTP 请求记录 (面向测试断言)。
 */
export type FakeEngineRequest = Readonly<{
  method: string;
  path: string;
  body: unknown;
  traceId: string | null;
}>;

export type FakeEnginesServer = Readonly<{
  /** 形如 "http://127.0.0.1:54321"；用作所有 5 engine adapter 的 baseUrl. */
  readonly url: string;
  /** 收到的请求日志 (FIFO);测试可断言 "每个 saga step 真实发起 HTTP call". */
  readonly receivedRequests: ReadonlyArray<FakeEngineRequest>;
  /** 关闭 server 释放端口 (best-effort;harness cleanup 调用). */
  close: () => Promise<void>;
}>;

/**
 * Liquidation 顺利路径 happy-path 响应工厂.
 *
 * 每个 endpoint 返回与对应 Engine Adapter parser 期望的 JSON schema 匹配
 * 的固定 mock 数据 (不依赖 request body — 顺利路径 5 step 不区分 caseId).
 *
 * Step 3 (ADL) 可能扩展;v1 不预测.
 */
const happyResponses: Record<string, () => Record<string, unknown>> = {
  "/query-mark-price": () => ({
    symbol: "BTC-USDT",
    markPrice: 50_000,
    queriedAt: new Date().toISOString()
  }),
  "/list-open-positions": () => ({
    accountId: "acct-pos-e2e",
    queriedAt: new Date().toISOString(),
    positions: [
      {
        positionId: "pos-e2e-1",
        symbol: "BTC-USDT",
        side: "long",
        size: 0.5
      }
    ]
  }),
  // status 必须是 OrderStatus 枚举: "pending" | "partially_filled" | "filled"
  // | "cancelled" | "rejected" (match-engine-http L144);happy path 用 "filled".
  "/place-order": () => ({
    orderId: "order-e2e-fake",
    status: "filled",
    placedAt: new Date().toISOString()
  }),
  "/release-margin": () => ({
    lockId: "lock-e2e-fake",
    releasedAmount: 1_000,
    currency: "USDT",
    releasedAt: new Date().toISOString()
  }),
  // status 必须是 TransferStatus 枚举: "pending" | "completed" | "failed"
  // (fund-engine-http L143); happy path 用 "completed".
  "/transfer-fund": () => ({
    transferId: "transfer-e2e-fake",
    status: "completed",
    transferredAt: new Date().toISOString()
  })
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });

const writeJson = (res: ServerResponse, statusCode: number, body: unknown): void => {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
};

/**
 * 创建 fake engines HTTP server (Liquidation 顺利路径 5 endpoint).
 *
 * 用法 (Step 2 e2e 测试)：
 *   const fakeServer = await createFakeEnginesServer();
 *   // 配置 5 engine adapter 全部用 fakeServer.url 作为 baseUrl
 *   ...
 *   // 测试结束:
 *   await fakeServer.close();
 *
 * port :0 自动分配 + IPv4 127.0.0.1 (避免 IPv6 + DNS 解析延迟).
 */
export const createFakeEnginesServer = async (): Promise<FakeEnginesServer> => {
  const receivedRequests: FakeEngineRequest[] = [];
  const openSockets = new Set<Socket>();

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const path = req.url ?? "/";
    const method = req.method ?? "GET";
    const traceHeader = req.headers["x-trace-id"];
    const traceId = typeof traceHeader === "string" ? traceHeader : null;

    let bodyJson: unknown = null;
    try {
      const bodyText = await readBody(req);
      if (bodyText.length > 0) {
        bodyJson = JSON.parse(bodyText) as unknown;
      }
    } catch {
      // Body parse 失败 → null;不阻塞 happy path response.
    }

    receivedRequests.push({ method, path, body: bodyJson, traceId });

    const responseFactory = happyResponses[path];
    if (responseFactory === undefined) {
      // 未知 endpoint → 404 + JSON;让 engine adapter 显式 fail 而非超时.
      writeJson(res, 404, { error: "endpoint_not_implemented", path });
      return;
    }
    writeJson(res, 200, responseFactory());
  };

  const server: Server = createServer((req, res) => {
    handler(req, res).catch(() => {
      // 安全网:任何 handler 异常 → 500. 端到端 happy path 不应触发.
      if (!res.writableEnded) {
        writeJson(res, 500, { error: "internal_server_error" });
      }
    });
  });
  server.on("connection", (socket: Socket) => {
    openSockets.add(socket);
    socket.on("close", () => {
      openSockets.delete(socket);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("fake-engines: failed to bind to 127.0.0.1:0");
  }
  const url = `http://127.0.0.1:${address.port}`;

  const close = async (): Promise<void> => {
    for (const socket of openSockets) {
      socket.destroy();
    }
    openSockets.clear();
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  };

  return {
    url,
    receivedRequests,
    close
  };
};
