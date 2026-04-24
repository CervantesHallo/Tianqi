import { describe, expect, it } from "vitest";

import { ERROR_CODES } from "../error-code.js";
import { ERROR_LAYERS } from "./error-layer.js";
import {
  adapterInitializationFailedError,
  configFileUnreadableError,
  configHistoryDirectoryUnreadableError,
  InfrastructureError
} from "./inf.js";

describe("TQ-INF error namespace", () => {
  it("constructs the TQ-INF-002 sample via factory", () => {
    const cause = new Error("connection refused");
    const error = adapterInitializationFailedError("event-store-sqlite", "db handle absent", cause);
    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.code).toBe(ERROR_CODES.ADAPTER_INITIALIZATION_FAILED);
    expect(error.code).toBe("TQ-INF-002");
    expect(error.layer).toBe(ERROR_LAYERS.INFRASTRUCTURE);
    expect(error.context).toEqual({
      adapterName: "event-store-sqlite",
      reason: "db handle absent"
    });
    expect(error.cause).toBe(cause);
  });

  it("marks every InfrastructureError with layer=infrastructure regardless of construction path", () => {
    const error = new InfrastructureError(
      ERROR_CODES.ADAPTER_INITIALIZATION_FAILED,
      "manual construction",
      { adapterName: "x", reason: "y" }
    );
    expect(error.layer).toBe("infrastructure");
  });

  it("serializes context via JSON round-trip without structural loss", () => {
    const error = adapterInitializationFailedError("kafka-notif", "bootstrap.servers missing");
    const serialized = JSON.parse(JSON.stringify(error.context)) as Record<string, unknown>;
    expect(serialized).toEqual(error.context);
  });

  it("rejects non-TQ-INF codes at the type layer", () => {
    // @ts-expect-error — TQ-SAG-001 cannot be assigned to an InfrastructureErrorCode slot
    const invalid = new InfrastructureError(ERROR_CODES.SAGA_STEP_TIMEOUT, "wrong", {});
    expect(invalid).toBeInstanceOf(InfrastructureError);
  });

  it("constructs the TQ-INF-011 config-file unreadable via factory", () => {
    const cause = new Error("ENOENT: no such file or directory");
    const error = configFileUnreadableError(
      "config-file",
      "/etc/tianqi/config.yaml",
      "file not found",
      cause
    );
    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.code).toBe(ERROR_CODES.CONFIG_FILE_UNREADABLE);
    expect(error.code).toBe("TQ-INF-011");
    expect(error.layer).toBe(ERROR_LAYERS.INFRASTRUCTURE);
    expect(error.context).toEqual({
      adapterName: "config-file",
      filePath: "/etc/tianqi/config.yaml",
      reason: "file not found"
    });
    expect(error.cause).toBe(cause);
  });

  it("constructs the TQ-INF-012 config-history-directory unreadable via factory", () => {
    const cause = new Error("EACCES: permission denied, mkdir");
    const error = configHistoryDirectoryUnreadableError(
      "config-file",
      "/etc/tianqi/config.yaml.tianqi-history",
      "mkdir denied",
      cause
    );
    expect(error).toBeInstanceOf(InfrastructureError);
    expect(error.code).toBe(ERROR_CODES.CONFIG_HISTORY_DIRECTORY_UNREADABLE);
    expect(error.code).toBe("TQ-INF-012");
    expect(error.layer).toBe(ERROR_LAYERS.INFRASTRUCTURE);
    expect(error.context).toEqual({
      adapterName: "config-file",
      historyDirectory: "/etc/tianqi/config.yaml.tianqi-history",
      reason: "mkdir denied"
    });
    expect(error.cause).toBe(cause);
  });

  it("distinguishes TQ-INF-012 from TQ-INF-011 despite both being config-file I/O", () => {
    // Convention K: the file is a single YAML; the history directory is a tree of
    // YAML/JSONL/JSON files. Their remediation runbooks diverge — mkdir/chmod -R vs
    // chmod on one file — so the two codes stay split.
    expect(ERROR_CODES.CONFIG_FILE_UNREADABLE).toBe("TQ-INF-011");
    expect(ERROR_CODES.CONFIG_HISTORY_DIRECTORY_UNREADABLE).toBe("TQ-INF-012");
    expect(ERROR_CODES.CONFIG_FILE_UNREADABLE).not.toBe(
      ERROR_CODES.CONFIG_HISTORY_DIRECTORY_UNREADABLE
    );
  });
});
