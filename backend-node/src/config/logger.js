import winston from 'winston';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logDir = process.env.LOG_DIR || path.join(__dirname, '../../logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Check if log directory is writable
let logDirWritable = false;
// FORCE CONSOLE LOGGING to avoid EPERM/WriteAfterEnd issues
console.log('[logger] Forcing console-only logging to avoid EPERM issues');

// Build transports
const transports = [
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.printf(
        ({ timestamp, level, message, service, ...meta }) => {
          return `${timestamp} [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
            }`;
        }
      )
    )
  })
];

if (logDirWritable) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'ufdr-backend' },
  transports
});

// Handle transport errors gracefully (don't crash)
logger.on('error', (err) => {
  console.error('[logger] Winston error:', err.message);
});

// Build audit transports
const auditTransports = [];
if (logDirWritable) {
  auditTransports.push(
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      maxsize: 10485760,
      maxFiles: 10
    })
  );
} else {
  auditTransports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, service, ...meta }) => {
            return `${timestamp} [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
              }`;
          }
        )
      )
    })
  );
}

// Create audit logger for security events
export const auditLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'ufdr-audit' },
  transports: auditTransports
});

auditLogger.on('error', (err) => {
  console.error('[audit-logger] Winston error:', err.message);
});

export default logger;

