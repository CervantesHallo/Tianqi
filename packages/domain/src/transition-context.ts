import type { ConfigVersion, TraceId } from "@tianqi/shared";

export type TransitionContext = {
  readonly traceId: TraceId;
  readonly reason: string;
  readonly triggeredBy: "system" | "manual";
  readonly configVersion: ConfigVersion;
  readonly transitionedAt: Date;
};
