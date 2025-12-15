/**
 * Error codes for client handling
 */
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  BAD_REQUEST = 'BAD_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
}

/**
 * Standard error response structure
 */
export interface ErrorResponse {
  error: string;
  code?: ErrorCode;
  status: number;
  requestId?: string;
  timestamp?: string;
}

/**
 * Sanitize error messages for production
 * Removes internal details that shouldn't be exposed to clients
 */
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;

    // Don't expose internal error details
    // Check for common patterns that might leak sensitive info
    if (
      message.includes('API key') ||
      message.includes('authentication') ||
      message.includes('unauthorized') ||
      message.includes('permission')
    ) {
      return 'Authentication error';
    }

    if (
      message.includes('network') ||
      message.includes('timeout') ||
      message.includes('connection')
    ) {
      return 'Service temporarily unavailable';
    }

    if (message.includes('database') || message.includes('D1')) {
      return 'Database error';
    }

    // For known validation errors, return the message as-is
    // This includes: Missing/invalid, too large, out of range, etc.
    if (
      message.includes('Missing or invalid') ||
      message.includes('Invalid') ||
      message.includes('too large') ||
      message.includes('too long') ||
      message.includes('cannot exceed') ||
      message.includes('must be') ||
      message.includes('out of range') ||
      message.includes('cannot be empty')
    ) {
      return message;
    }

    // Default: generic error message
    return 'An error occurred processing your request';
  }

  return 'Unknown error';
}

/**
 * Create a standardized error response
 */
export function createErrorResponse(
  error: unknown,
  status: number = 500,
  code?: ErrorCode,
  requestId?: string
): ErrorResponse {
  const message = sanitizeErrorMessage(error);
  return {
    error: message,
    code: code || (status >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.BAD_REQUEST),
    status,
    requestId,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Missing or invalid') ||
      error.message.includes('Invalid') ||
      error.message.includes('validation')
    );
  }
  return false;
}

