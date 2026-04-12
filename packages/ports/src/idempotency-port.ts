import type { CommandResultReference, IdempotencyKey, Result } from "@tianqi/shared";

export type IdempotencyReservation = {
  readonly status: "accepted" | "duplicate" | "not_enforced";
  readonly resultReference?: CommandResultReference;
};

export type IdempotencyPortError = {
  readonly message: string;
};

export type IdempotencyPort = {
  reserve(
    commandName: string,
    key: IdempotencyKey
  ): Promise<Result<IdempotencyReservation, IdempotencyPortError>>;
};
