// errors.js — Custom error class and helpers
// All API errors should be instances of AppError so the error-handling
// middleware can format them consistently.

export class AppError extends Error {
  constructor(statusCode, code, message) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

// Helper factories for the common error cases
// These exist so route handlers stay short and readable:
//   throw notFound('Board not found')
// instead of:
//   throw new AppError(404, 'NOT_FOUND', 'Board not found')

export const notFound = (message = 'Resource not found') =>
  new AppError(404, 'NOT_FOUND', message)

export const validationError = (message = 'Validation failed') =>
  new AppError(400, 'VALIDATION_ERROR', message)

export const invalidStatus = (message = 'Invalid status') =>
  new AppError(400, 'INVALID_STATUS', message)
