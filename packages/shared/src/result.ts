export type Result<TValue, TError> =
  | { readonly ok: true; readonly value: TValue }
  | { readonly ok: false; readonly error: TError };

export const ok = <TValue>(value: TValue): Result<TValue, never> => ({
  ok: true,
  value
});

export const err = <TError>(error: TError): Result<never, TError> => ({
  ok: false,
  error
});
