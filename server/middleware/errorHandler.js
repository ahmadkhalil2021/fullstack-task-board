// errorHandler.js — Express middleware that converts errors to JSON responses
// Mount this LAST in the middleware chain so it catches errors from all routes.
//
// Two cases:
// 1. AppError instances — already have statusCode + code, just format the response
// 2. Mongoose errors (CastError, ValidationError) — map to our error codes
// 3. Everything else — 500 INTERNAL_ERROR (don't leak internal details to clients)

import mongoose from 'mongoose'
import { AppError } from '../lib/errors.js'

export const errorHandler = (err, req, res, next) => {
  // Pass through if headers already sent (Express-specific pattern)
  if (res.headersSent) return next(err)

  // Handle Mongoose CastError (e.g. invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Resource not found' }
    })
  }

  // Handle Mongoose ValidationError
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: err.message }
    })
  }

  // Handle our custom AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message }
    })
  }

  // Unknown error — log it for debugging, return generic 500
  console.error('Unhandled error:', err)
  res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' }
  })
}
