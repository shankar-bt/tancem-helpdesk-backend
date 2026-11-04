import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import { env, isProduction } from './config/env';
import { errorHandler, notFoundHandler, globalLimiter, authenticate } from './shared/middleware';
import { apiRouter } from './shared/router';
import { ticketController } from './modules/tickets/controllers/ticket.controller';

export function createApp() {
  const app = express();

  const allowedOrigins = env.CORS_ORIGIN.split(',').map((o) => o.trim());

  // Hardened Production Security Headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      frameguard: { action: 'deny' }, // Mitigate Clickjacking: X-Frame-Options: DENY
      xContentTypeOptions: true, // Prevent MIME-type sniffing: X-Content-Type-Options: nosniff
      dnsPrefetchControl: { allow: false },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false, // Disabled in local dev to allow plain HTTP localhost
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'"],
              styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'", ...allowedOrigins],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
    })
  );

  // Explicitly remove X-Powered-By to prevent framework fingerprinting
  app.disable('x-powered-by');

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Apply global rate limiter to mitigate DoS / brute-force scanning
  app.use(globalLimiter);

  const uploadsDir = path.resolve(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // Authenticated and protected attachment access: requires valid session/token
  app.get('/uploads/:filename', authenticate, (req, res, next) => {
    try {
      ticketController.serveAttachment(req, res);
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
