import type { Brand } from "./brand.js";

export type RiskCaseId = Brand<string, "RiskCaseId">;
export type LiquidationCaseId = Brand<string, "LiquidationCaseId">;
export type ADLCaseId = Brand<string, "ADLCaseId">;
export type EventId = Brand<string, "EventId">;
export type AuditId = Brand<string, "AuditId">;
export type TraceId = Brand<string, "TraceId">;
export type ConfigVersion = Brand<number, "ConfigVersion">;

const assertNonEmptyString = (value: string, label: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return normalized;
};

const assertPositiveInteger = (value: number, label: string): number => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
};

export const createRiskCaseId = (value: string): RiskCaseId =>
  assertNonEmptyString(value, "RiskCaseId") as RiskCaseId;

export const createLiquidationCaseId = (value: string): LiquidationCaseId =>
  assertNonEmptyString(value, "LiquidationCaseId") as LiquidationCaseId;

export const createADLCaseId = (value: string): ADLCaseId =>
  assertNonEmptyString(value, "ADLCaseId") as ADLCaseId;

export const createEventId = (value: string): EventId =>
  assertNonEmptyString(value, "EventId") as EventId;

export const createAuditId = (value: string): AuditId =>
  assertNonEmptyString(value, "AuditId") as AuditId;

export const createTraceId = (value: string): TraceId =>
  assertNonEmptyString(value, "TraceId") as TraceId;

export const createConfigVersion = (value: number): ConfigVersion =>
  assertPositiveInteger(value, "ConfigVersion") as ConfigVersion;
