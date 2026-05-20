export const SECURITY_ERROR_MESSAGES = {
  RATE_LIMITED: 'Too many requests. Please wait.',
  REQUEST_IN_PROGRESS: 'Order already processing.',
  INVALID_REQUEST: 'Invalid request.',
  UNAUTHORIZED: 'Unauthorized action.',
  TRY_AGAIN_LATER: 'Please try again later.',
  ACTION_BLOCKED: 'Action blocked for security reasons.',
} as const;

export type SecurityErrorCode = keyof typeof SECURITY_ERROR_MESSAGES;

export class SecurityError extends Error {
  readonly code: SecurityErrorCode;

  constructor(code: SecurityErrorCode, message?: string) {
    super(message ?? SECURITY_ERROR_MESSAGES[code]);
    this.name = 'SecurityError';
    this.code = code;
  }
}

export function securityError(code: SecurityErrorCode, message?: string): SecurityError {
  return new SecurityError(code, message);
}
