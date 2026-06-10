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
//   - Step 3 (ADL) 扩展 endpoint 集合 — 已实施 (2026-06-03)：新增 2 个
//     happyResponses key（/query-mark-price-batch + /query-position）
//     支持 ADL Saga 5 step（fetch-mark-prices / verify-targets / submit-
//     deleveraging-orders / insurance-fund-deduction / settle-account-funds）
//     —— 不改 export 签名（元规则 B 严守）；仅 internal const 扩展。
//   - Step 4 (Liquidation 补偿路径) 扩展 — 已实施 (2026-06-03)：
//     * 新增 2 个 happyResponses key（/lock-margin + /cancel-order）支持
//       P 终态测试 (补偿链 step 4 → 3 反向调用)
//     * 新增 export FakeFailureRule + FakeEnginesServerOptions
//     * createFakeEnginesServer 签名扩展接受可选 options 参数（既有 Step 2 +
//       Step 3 无参调用零影响；元规则 B 兼容）
//     * caseId 路由失败注入：按 x-trace-id substring + path 匹配返回 failure
//       response（Q 终态测试需要）
//   - Step 5 (ADL 补偿路径) 扩展 — 已实施 (2026-06-10)：
//     * ADL step 4 + step 5 同用 /transfer-fund endpoint（区分依赖 body.idempotencyKey
//       子串 :insurance / :settle: / :reverse-insurance / :reverse-settle: 等）
//     * FakeFailureRule 新增 optional bodyIdempotencyKeyPattern 字段（Readonly type
//       可选字段；向后兼容 — Step 4 既有 callers 不需要修改；元规则 B 兼容）
//     * matchFailureRule 增加 body inspection（仅当 rule.bodyIdempotencyKeyPattern
//       存在时检查 body.idempotencyKey 是否含 pattern 子串）
//     * 不改 createFakeEnginesServer / FakeEnginesServerOptions / FakeEnginesServer
//       接口签名（仅 FakeFailureRule schema 字段新增 optional 字段）

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
 * Phase 11 / Step 4 — 失败注入规则（K.5 候选 α: caseId 路由）。
 *
 * 用途：让特定测试 case 触发某 step 的 Engine 调用失败，进而触发 Saga
 * 补偿路径（P 终态）或补偿失败死信（Q 终态）。
 *
 * 匹配机制：fake server 收到 request 时按 x-trace-id 头部 substring 匹配
 * traceIdPattern + path 完全匹配。命中即返回 failure response（默认 500 +
 * test_injected_failure；可显式自定义）。
 *
 * 与 happyResponses 关系：failure rules 优先级高于 happyResponses；
 * 未命中失败规则时 fallback 到 happyResponses。
 *
 * 元规则 B：FakeFailureRule 字段一旦发布即冻结。
 */
export type FakeFailureRule = Readonly<{
  /** x-trace-id 头部 substring；命中即触发失败。 */
  readonly traceIdPattern: string;
  /** HTTP path that should fail. */
  readonly path: string;
  /** HTTP status code; 默认 500. */
  readonly statusCode?: number;
  /** Response body; 默认 { error: "test_injected_failure" }. */
  readonly responseBody?: Record<string, unknown>;
  /**
   * Phase 11 / Step 5 (2026-06-10) 扩展（K.5 候选 γ；元规则 B 兼容 — Readonly type
   * 加 optional 字段）：当 request body 含 idempotencyKey 字段且匹配 substring 时触发失败；
   * 未指定 = 不约束 body（与 Step 4 既有 callers 兼容）。
   *
   * 用途：ADL Saga step 4 (insurance-fund-deduction) + step 5 (settle-account-funds)
   * 都用 /transfer-fund endpoint；区分依赖 body.idempotencyKey 子串
   * (`:insurance` / `:settle:` / `:reverse-insurance` / `:reverse-settle:`)。
   */
  readonly bodyIdempotencyKeyPattern?: string;
}>;

/**
 * Phase 11 / Step 4 — createFakeEnginesServer 可选 options。
 *
 * 既有 Step 2 + Step 3 调用 createFakeEnginesServer() 不变（options 缺省 →
 * happy-only 路径；元规则 B 兼容）。Step 4 调用
 * createFakeEnginesServer({ caseFailureRules: [...] }) 启用失败注入。
 */
export type FakeEnginesServerOptions = Readonly<{
  /** 可选失败注入规则列表；缺省仅 happy 路径。 */
  readonly caseFailureRules?: ReadonlyArray<FakeFailureRule>;
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
  }),
  // Phase 11 / Step 3 ADL Saga 扩展 (2026-06-03)：
  // queryMarkPriceBatch 批量标记价响应（与 parseQueryMarkPriceBatchResponse
  // 约束一致：顶层 queriedAt + prices 数组；每 price 含 symbol + markPrice）。
  // 顺利路径返回 ADL e2e fixture 用到的 2 个 symbol（BTC-USDT + ETH-USDT）；
  // adapter parser 仅校验 schema 不校验数组长度（顺利路径不依赖 request body）。
  "/query-mark-price-batch": () => ({
    queriedAt: new Date().toISOString(),
    prices: [
      { symbol: "BTC-USDT", markPrice: 50_000 },
      { symbol: "ETH-USDT", markPrice: 3_000 }
    ]
  }),
  // Phase 11 / Step 3 ADL Saga 扩展 (2026-06-03)：
  // queryPosition 单账户单 symbol 持仓响应（与 parseQueryPositionResponse
  // 约束一致：accountId + symbol + positionId 必含字段（可 null）+
  // side（positionId 非 null 时必含 "long"|"short"）+ size + queriedAt）。
  // ADL verify-targets step 顺利路径需 positionId 非 null（targets[] 候选盈利
  // 账户应有持仓；side 标记盈利方向）；fake 返回固定 long 0.5 size。
  "/query-position": () => ({
    accountId: "acct-pos-adl-e2e",
    symbol: "BTC-USDT",
    positionId: "pos-adl-e2e-fake",
    side: "long",
    size: 0.5,
    queriedAt: new Date().toISOString()
  }),
  // Phase 11 / Step 4 Liquidation 补偿路径扩展 (2026-06-03)：
  // lockMargin compensate Step 4 release-margin 反向调用（与
  // parseLockMarginResponse 约束一致：lockId + lockedAmount (非负数) +
  // currency + lockedAt）。P 终态测试需此 endpoint 在 fake server 返回 200。
  "/lock-margin": () => ({
    lockId: "lock-compensate-e2e-fake",
    lockedAmount: 1_000,
    currency: "USDT",
    lockedAt: new Date().toISOString()
  }),
  // Phase 11 / Step 4 Liquidation 补偿路径扩展 (2026-06-03)：
  // cancelOrder compensate Step 3 submit-close-orders 反向调用（与
  // parseCancelOrderResponse 约束一致：orderId + status (OrderStatus 枚举
  // 必须是 "cancelled"对应补偿语义) + cancelledAt）。P 终态测试需此 endpoint 200。
  "/cancel-order": () => ({
    orderId: "order-compensate-e2e-fake",
    status: "cancelled",
    cancelledAt: new Date().toISOString()
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
 * 创建 fake engines HTTP server (Liquidation 顺利路径 + 补偿路径 endpoint).
 *
 * 用法 (Step 2 / Step 3 e2e 测试 - happy only)：
 *   const fakeServer = await createFakeEnginesServer();
 *
 * 用法 (Step 4 e2e 测试 - 补偿路径，含失败注入)：
 *   const fakeServer = await createFakeEnginesServer({
 *     caseFailureRules: [
 *       { traceIdPattern: "compensation-Q-test", path: "/transfer-fund" },
 *       { traceIdPattern: "compensation-Q-test", path: "/lock-margin" }
 *     ]
 *   });
 *
 * port :0 自动分配 + IPv4 127.0.0.1 (避免 IPv6 + DNS 解析延迟).
 *
 * 元规则 B：options 参数可选；既有 Step 2 + Step 3 无参调用零影响。
 */
export const createFakeEnginesServer = async (
  options?: FakeEnginesServerOptions
): Promise<FakeEnginesServer> => {
  const receivedRequests: FakeEngineRequest[] = [];
  const openSockets = new Set<Socket>();
  const failureRules: ReadonlyArray<FakeFailureRule> =
    options?.caseFailureRules ?? [];

  /**
   * 失败规则匹配：traceId substring + path 完全匹配 + 可选 body.idempotencyKey
   * substring（Phase 11 / Step 5 扩展 — ADL step 4 vs step 5 区分场景）。
   * 返回首个匹配规则；未命中返回 undefined（fallback 到 happyResponses）。
   */
  const matchFailureRule = (
    path: string,
    traceId: string | null,
    body: unknown
  ): FakeFailureRule | undefined => {
    if (failureRules.length === 0 || traceId === null) return undefined;
    for (const rule of failureRules) {
      if (rule.path !== path) continue;
      if (!traceId.includes(rule.traceIdPattern)) continue;
      // Phase 11 / Step 5 K.5 候选 γ：可选 body.idempotencyKey 匹配
      if (rule.bodyIdempotencyKeyPattern !== undefined) {
        if (body === null || typeof body !== "object" || Array.isArray(body)) continue;
        const bodyObj = body as Record<string, unknown>;
        const idempotencyKey = bodyObj["idempotencyKey"];
        if (typeof idempotencyKey !== "string") continue;
        if (!idempotencyKey.includes(rule.bodyIdempotencyKeyPattern)) continue;
      }
      return rule;
    }
    return undefined;
  };

  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const path = req.url ?? "/";
    const method = req.method ?? "GET";
    // Phase 11 / Step 4 修复：external-engine-http-base 实际发送的 trace header
    // 是 "x-tianqi-trace-id"（DEFAULT_TRACE_HEADER_NAME；详见 http-base-engine.ts
    // 行 119），而非 "x-trace-id"。Step 2 + Step 3 e2e 不断言 traceId 字段，所以
    // 该 latent bug 未被暴露；Step 4 失败规则匹配依赖正确读取 traceId 才在 CI
    // run #1 暴露此问题（5/6 it 失败因失败注入未触发）。修复：优先读
    // "x-tianqi-trace-id"，回退兼容 "x-trace-id"（FakeEngineRequest.traceId
    // 字段语义不变；与既有 e2e 测试断言假设兼容）.
    const tianqiTraceHeader = req.headers["x-tianqi-trace-id"];
    const legacyTraceHeader = req.headers["x-trace-id"];
    const traceId =
      typeof tianqiTraceHeader === "string"
        ? tianqiTraceHeader
        : typeof legacyTraceHeader === "string"
          ? legacyTraceHeader
          : null;

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

    // K.5 候选 α (Step 4) / γ (Step 5)：优先匹配失败规则（caseId 路由 + 可选 body
    // matching）→ fallback happyResponses → 404.
    const failureRule = matchFailureRule(path, traceId, bodyJson);
    if (failureRule !== undefined) {
      writeJson(
        res,
        failureRule.statusCode ?? 500,
        failureRule.responseBody ?? { error: "test_injected_failure", path }
      );
      return;
    }

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
