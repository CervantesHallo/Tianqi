export type Brand<TValue, TTag extends string> = TValue & {
  readonly __brand: TTag;
};
