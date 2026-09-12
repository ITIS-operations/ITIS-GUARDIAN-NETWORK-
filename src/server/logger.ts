/**
 * ==============================================================================
 * ITIS GUARDIAN NETWORK — PRODUCTION-SAFE LOGGING & OBSERVABILITY ENGINE
 * ==============================================================================
 * Provides structured, context-aware logging with automatic PII & credential redaction,
 * request correlation IDs, and clear separation of security/audit categories.
 */

import express from 'express';
import crypto from 'crypto';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export interface LogContext {
  correlationId?: string;
  userId?: string;
  role?: string;
  schoolId?: string;
  ipAddress?: string;
  endpoint?: string;
  category?: string;
  [key: string]: any;
}

const REDACTED_KEYS = new Set([
  'password',
  'passwordhash',
  'password_hash',
  'passwordsalt',
  'password_salt',
  'token',
  'sessiontoken',
  'session_token',
  'authorization',
  'bearer',
  'totpsecret',
  'totp_secret',
  'mfasecret',
  'mfa_secret',
  'backupcode',
  'backup_code',
  'backupcodes',
  'backup_codes',
  'secret',
  'apikey',
  'api_key',
  'credential',
  'credentials',
  'databaseurl',
  'database_url'
]);

/**
 * Recursively redacts sensitive keys and patterns from log payloads
 */
export function sanitizeLogData(input: any): any {
  if (input === null || input === undefined) return input;
  if (typeof input === 'string') {
    // Redact Bearer token strings
    if (input.toLowerCase().startsWith('bearer ')) {
      return 'Bearer [REDACTED_TOKEN]';
    }
    // Redact postgres:// URLs with embedded passwords
    if (input.includes('postgres://') || input.includes('postgresql://')) {
      return input.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:[REDACTED_PASSWORD]@');
    }
    return input;
  }

  if (Array.isArray(input)) {
    return input.map(item => sanitizeLogData(item));
  }

  if (typeof input === 'object') {
    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      const lower = key.toLowerCase().replace(/[-_]/g, '');
      if (REDACTED_KEYS.has(lower) || lower.includes('password') || lower.includes('secret') || lower.includes('token')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeLogData(value);
      }
    }
    return sanitized;
  }

  return input;
}

class ProductionLogger {
  private formatMessage(level: LogLevel, message: string, context?: LogContext, data?: any): string {
    const timestamp = new Date().toISOString();
    const correlation = context?.correlationId ? ` [cid:${context.correlationId.slice(0, 12)}]` : '';
    const category = context?.category ? ` [${context.category}]` : '';

    if (process.env.NODE_ENV === 'production') {
      const payload: Record<string, any> = {
        timestamp,
        level,
        message,
        ...context
      };
      if (data !== undefined) {
        payload.data = sanitizeLogData(data);
      }
      return JSON.stringify(payload);
    }

    const cleanData = data !== undefined ? ` ${JSON.stringify(sanitizeLogData(data))}` : '';
    return `[${timestamp}] [${level}]${correlation}${category} ${message}${cleanData}`;
  }

  public info(message: string, context?: LogContext, data?: any): void {
    console.log(this.formatMessage('INFO', message, context, data));
  }

  public warn(message: string, context?: LogContext, data?: any): void {
    console.warn(this.formatMessage('WARN', message, context, data));
  }

  public error(message: string, context?: LogContext, error?: any): void {
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: process.env.NODE_ENV === 'production' ? undefined : error.stack }
      : error;
    console.error(this.formatMessage('ERROR', message, context, errorDetails));
  }

  public security(message: string, context?: LogContext, details?: any): void {
    console.warn(this.formatMessage('SECURITY', `[SECURITY ALERT] ${message}`, context, details));
  }
}

export const logger = new ProductionLogger();

/**
 * Express middleware to propagate or issue request correlation IDs
 */
export function correlationMiddleware(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const incomingId = (
    req.headers['x-correlation-id'] ||
    req.headers['x-request-id'] ||
    ''
  ).toString().trim();

  const correlationId = incomingId || `req-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}
