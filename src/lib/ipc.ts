import type { ErrorCode, KirishotError } from './bindings';

export * from './bindings';

type Result<T, E> = { status: 'ok'; data: T } | { status: 'error'; error: E };

/** Error thrown by `unwrap`, carrying the code sent by Rust. */
export class KirishotException extends Error {
  readonly code: ErrorCode;

  constructor(error: KirishotError) {
    super(error.message);
    this.name = 'KirishotException';
    this.code = error.code;
  }
}

/** Returns the command's data, or throws a KirishotException. */
export function unwrap<T>(result: Result<T, KirishotError>): T {
  if (result.status === 'ok') return result.data;
  throw new KirishotException(result.error);
}
