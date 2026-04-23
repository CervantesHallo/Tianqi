export const ERROR_LAYERS = {
  INFRASTRUCTURE: "infrastructure",
  SAGA: "saga",
  CONTRACT: "contract"
} as const;

export type ErrorLayer = (typeof ERROR_LAYERS)[keyof typeof ERROR_LAYERS];

export type TianqiErrorContext = Readonly<Record<string, unknown>>;
