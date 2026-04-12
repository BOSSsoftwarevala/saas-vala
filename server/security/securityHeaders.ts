import { Request, Response, NextFunction } from 'express';
import { UltraLogger } from '../logger';

export class SecurityHeaders {
  constructor(private logger: UltraLogger) {}

  // Set all security headers
  setSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
    try {
      // HSTS (HTTP Strict Transport Security)
      if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      }

      // X-Frame-Options (Clickjacking protection)
      res.setHeader('X-Frame-Options', 'DENY');

      // X-Content-Type-Options (MIME type sniffing protection)
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // X-XSS-Protection (Legacy XSS protection)
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Referrer Policy
      res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

      // Permissions Policy (formerly Feature Policy)
      res.setHeader('Permissions-Policy', this.buildPermissionsPolicy());

      // Content Security Policy
      res.setHeader('Content-Security-Policy', this.buildCSP(req));

      // Cross-Origin Embedder Policy
      res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');

      // Cross-Origin Opener Policy
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

      // Cross-Origin Resource Policy
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

      // Clear Site Data on logout (for sensitive routes)
      if (req.path === '/logout') {
        res.setHeader('Clear-Site-Data', '"cache", "cookies", "storage", "executionContexts"');
      }

      next();
    } catch (error: any) {
      this.logger.error('Security headers error', { error: error.message });
      next(); // Fail open - don't break the app if headers fail
    }
  };

  // CORS configuration
  configureCORS = (allowedOrigins: string[] = []) => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const origin = req.headers.origin;
        
        // Default allowed origins
        const defaultOrigins = [
          'http://localhost:3000',
          'http://localhost:5173',
          'https://www.saasvala.com',
          'https://saasvala.com'
        ];
        
        const allAllowedOrigins = [...defaultOrigins, ...allowedOrigins];

        // Check if origin is allowed
        if (origin && allAllowedOrigins.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        } else if (!origin) {
          // Allow requests without Origin header (same-origin)
          res.setHeader('Access-Control-Allow-Origin', '*');
        }

        // Set other CORS headers
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', [
          'Origin',
          'X-Requested-With',
          'Content-Type',
          'Accept',
          'Authorization',
          'X-CSRF-Token',
          'X-Device-ID'
        ].join(', '));
        
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours

        // Handle preflight requests
        if (req.method === 'OPTIONS') {
          return res.status(200).end();
        }

        next();
      } catch (error: any) {
        this.logger.error('CORS error', { error: error.message, origin: req.headers.origin });
        next(); // Fail open
      }
    };
  };

  // Build Content Security Policy
  private buildCSP(req: Request): string {
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const isAPIRoute = req.path.startsWith('/api/');

    if (isAPIRoute) {
      // Stricter CSP for API routes
      return [
        "default-src 'none'",
        "script-src 'none'",
        "style-src 'none'",
        "img-src 'none'",
        "font-src 'none'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'none'",
        "form-action 'none'"
      ].join('; ');
    }

    // CSP for web routes
    const directives = [
      "default-src 'self'",
      isDevelopment ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' ws:" : "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      isDevelopment ? "" : "upgrade-insecure-requests"
    ].filter(Boolean);

    // Add trusted domains if configured
    const trustedDomains = process.env.CSP_TRUSTED_DOMAINS?.split(',') || [];
    if (trustedDomains.length > 0) {
      directives.push(`trusted-domains ${trustedDomains.join(' ')}`);
    }

    return directives.join('; ');
  }

  // Build Permissions Policy
  private buildPermissionsPolicy(): string {
    const policies = [
      'geolocation=()',
      'microphone=()',
      'camera=()',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'ambient-light-sensor=()',
      'autoplay=(self)',
      'document-domain=()',
      'encrypted-media=(self)',
      'fullscreen=(self)',
      'picture-in-picture=(self)',
      'publickey-credentials-get=(self)',
      'screen-wake-lock=()',
      'sync-xhr=(self)',
      'xr-spatial-tracking=()'
    ];

    return policies.join(', ');
  }

  // API-specific security headers
  setAPISecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
    try {
      // Remove server information
      res.removeHeader('Server');
      res.setHeader('Server', 'SecureServer');

      // API-specific headers
      res.setHeader('X-API-Version', '1.0.0');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // Rate limit headers (will be set by rate limiting middleware)
      res.setHeader('X-RateLimit-Limit', '100');
      res.setHeader('X-RateLimit-Remaining', '99');
      res.setHeader('X-RateLimit-Reset', Math.ceil(Date.now() / 1000 + 900).toString());

      // Cache control for API responses
      if (req.method === 'GET') {
        res.setHeader('Cache-Control', 'private, max-age=300'); // 5 minutes
      } else {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }

      next();
    } catch (error: any) {
      this.logger.error('API security headers error', { error: error.message });
      next();
    }
  };

  // Static file security headers
  setStaticFileHeaders = (req: Request, res: Response, next: NextFunction) => {
    try {
      const ext = req.path.split('.').pop()?.toLowerCase();

      // Set appropriate headers based on file type
      switch (ext) {
        case 'js':
          res.setHeader('Content-Type', 'application/javascript');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          break;
        case 'css':
          res.setHeader('Content-Type', 'text/css');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          break;
        case 'html':
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          break;
        case 'json':
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('X-Content-Type-Options', 'nosniff');
          break;
        case 'png':
        case 'jpg':
        case 'jpeg':
        case 'gif':
        case 'webp':
          res.setHeader('X-Content-Type-Options', 'nosniff');
          break;
      }

      // Cache control for static assets
      if (['js', 'css', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'woff', 'woff2'].includes(ext || '')) {
        const maxAge = process.env.NODE_ENV === 'production' ? 31536000 : 0; // 1 year in production, no cache in development
        res.setHeader('Cache-Control', `public, max-age=${maxAge}, immutable`);
      }

      next();
    } catch (error: any) {
      this.logger.error('Static file headers error', { error: error.message });
      next();
    }
  };

  // Remove sensitive headers from response
  removeSensitiveHeaders = (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data: any) {
      // Remove sensitive headers that might leak information
      res.removeHeader('X-Powered-By');
      res.removeHeader('Server');
      
      // Add generic server header
      if (!res.getHeader('Server')) {
        res.setHeader('Server', 'SecureServer');
      }
      
      return originalSend.call(this, data);
    };

    next();
  };

  // Validate origin for sensitive operations
  validateOrigin = (allowedOrigins: string[] = []) => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const origin = req.headers.origin;
        const referer = req.headers.referer;
        
        // Default allowed origins
        const defaultOrigins = [
          'https://www.saasvala.com',
          'https://saasvala.com'
        ];
        
        const allAllowedOrigins = [...defaultOrigins, ...allowedOrigins];

        // Check origin header
        if (origin && !allAllowedOrigins.includes(origin)) {
          this.logger.warn('Invalid origin for sensitive operation', {
            origin,
            path: req.path,
            ip: req.ip
          });
          
          return res.status(403).json({
            error: 'Invalid origin',
            code: 'INVALID_ORIGIN'
          });
        }

        // Check referer header as fallback
        if (referer && !allAllowedOrigins.some(allowed => referer.startsWith(allowed))) {
          this.logger.warn('Invalid referer for sensitive operation', {
            referer,
            path: req.path,
            ip: req.ip
          });
          
          return res.status(403).json({
            error: 'Invalid referer',
            code: 'INVALID_REFERER'
          });
        }

        next();
      } catch (error: any) {
        this.logger.error('Origin validation error', { error: error.message });
        next();
      }
    };
  };

  // Download-specific headers
  setDownloadHeaders = (req: Request, res: Response, next: NextFunction) => {
    try {
      // Prevent content-type sniffing for downloads
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Set download-specific headers
      res.setHeader('X-Download-Options', 'noopen');
      
      // Prevent caching of downloads
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      next();
    } catch (error: any) {
      this.logger.error('Download headers error', { error: error.message });
      next();
    }
  };
}

export default SecurityHeaders;
