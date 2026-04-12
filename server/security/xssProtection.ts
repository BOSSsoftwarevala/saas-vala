import { Request, Response, NextFunction } from 'express';
import { UltraLogger } from '../logger';

export class XSSProtection {
  constructor(private logger: UltraLogger) {}

  // Sanitize input data
  sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
    try {
      // Sanitize request body
      if (req.body) {
        req.body = this.sanitizeObject(req.body);
      }

      // Sanitize query parameters
      if (req.query) {
        req.query = this.sanitizeObject(req.query);
      }

      // Sanitize URL parameters
      if (req.params) {
        req.params = this.sanitizeObject(req.params);
      }

      next();
    } catch (error: any) {
      this.logger.error('Input sanitization error', { error: error.message });
      next();
    }
  };

  // Sanitize output data
  sanitizeOutput = (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;
    const originalSend = res.send;

    // Override res.json to sanitize output
    res.json = (data: any) => {
      try {
        const sanitizedData = this.sanitizeObject(data);
        return originalJson.call(res, sanitizedData);
      } catch (error: any) {
        this.logger.error('Output sanitization error', { error: error.message });
        return originalJson.call(res, data);
      }
    };

    // Override res.send to sanitize output
    res.send = (data: any) => {
      try {
        if (typeof data === 'string') {
          const sanitizedData = this.sanitizeString(data);
          return originalSend.call(res, sanitizedData);
        } else if (typeof data === 'object') {
          const sanitizedData = this.sanitizeObject(data);
          return originalSend.call(res, sanitizedData);
        }
        return originalSend.call(res, data);
      } catch (error: any) {
        this.logger.error('Output sanitization error', { error: error.message });
        return originalSend.call(res, data);
      }
    };

    next();
  };

  // Set XSS protection headers
  setXSSHeaders = (req: Request, res: Response, next: NextFunction) => {
    // XSS Protection header (legacy but still useful)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Content Security Policy
    res.setHeader('Content-Security-Policy', this.buildCSP());
    
    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    next();
  };

  // Sanitize object recursively
  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const sanitizedKey = this.sanitizeString(key);
        sanitized[sanitizedKey] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  // Sanitize string for XSS
  private sanitizeString(str: string): string {
    if (typeof str !== 'string') {
      return str;
    }

    return str
      // Remove <script> tags and their content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove other potentially dangerous tags
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*>/gi, '')
      .replace(/<link\b[^<]*>/gi, '')
      .replace(/<meta\b[^<]*>/gi, '')
      // Escape HTML entities
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      // Remove javascript: and data: URLs
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, '')
      // Remove on* event handlers
      .replace(/on\w+\s*=/gi, '')
      // Remove eval() expressions
      .replace(/eval\s*\(/gi, '')
      .replace(/setTimeout\s*\(/gi, '')
      .replace(/setInterval\s*\(/gi, '');
  }

  // Build Content Security Policy
  private buildCSP(): string {
    const directives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Adjust based on needs
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ];

    // Add trusted domains if configured
    const trustedDomains = process.env.CSP_TRUSTED_DOMAINS?.split(',') || [];
    if (trustedDomains.length > 0) {
      directives.push(`trusted-domains ${trustedDomains.join(' ')}`);
    }

    return directives.join('; ');
  }

  // Validate and sanitize HTML content
  sanitizeHTML(html: string): string {
    if (typeof html !== 'string') {
      return html;
    }

    // Basic HTML sanitization - in production, use a library like DOMPurify
    return html
      // Remove dangerous tags
      .replace(/<(script|iframe|object|embed|link|meta|form|input|button)[^>]*>/gi, '')
      .replace(/<\/(script|iframe|object|embed|link|meta|form|input|button)>/gi, '')
      // Remove dangerous attributes
      .replace(/\s+(on\w+|javascript:|data:|vbscript:)[^>]*>/gi, '>')
      // Remove style tags with dangerous content
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      // Sanitize remaining HTML
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Check for XSS patterns
  detectXSS(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /eval\s*\(/gi,
      /setTimeout\s*\(/gi,
      /setInterval\s*\(/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi,
      /data:text\/html/gi,
      /vbscript:/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  // Middleware to detect and block XSS attempts
  blockXSSAttempts = (req: Request, res: Response, next: NextFunction) => {
    const checkValue = (value: any, path: string = ''): boolean => {
      if (typeof value === 'string') {
        if (this.detectXSS(value)) {
          this.logger.warn('XSS attempt detected', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            field: path,
            value: value.substring(0, 100)
          });
          return true;
        }
      } else if (typeof value === 'object' && value !== null) {
        for (const [key, val] of Object.entries(value)) {
          if (checkValue(val, path ? `${path}.${key}` : key)) {
            return true;
          }
        }
      }
      return false;
    };

    // Check all request data
    const hasXSS = 
      checkValue(req.body, 'body') ||
      checkValue(req.query, 'query') ||
      checkValue(req.params, 'params');

    if (hasXSS) {
      return res.status(400).json({
        error: 'Invalid input detected',
        code: 'XSS_DETECTED'
      });
    }

    next();
  };

  // Sanitize user-generated content for display
  sanitizeUserContent(content: string, allowHTML: boolean = false): string {
    if (typeof content !== 'string') {
      return content;
    }

    if (allowHTML) {
      return this.sanitizeHTML(content);
    } else {
      return this.sanitizeString(content);
    }
  }

  // Validate file upload for XSS
  validateFileUpload(buffer: Buffer, filename: string): {
    safe: boolean;
    reason?: string;
  } {
    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
    
    // Check for HTML/Script content in files that shouldn't have it
    const dangerousExtensions = ['.txt', '.csv', '.json', '.xml', '.md'];
    const fileExt = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    
    if (dangerousExtensions.includes(fileExt)) {
      if (this.detectXSS(content)) {
        return {
          safe: false,
          reason: 'File contains potentially dangerous script content'
        };
      }
    }

    // Check for executable file signatures
    const executableSignatures = [
      Buffer.from('MZ', 'utf8'), // Windows PE
      Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // Linux ELF
      Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class
    ];

    for (const signature of executableSignatures) {
      if (buffer.subarray(0, signature.length).equals(signature)) {
        return {
          safe: false,
          reason: 'Executable file detected'
        };
      }
    }

    return { safe: true };
  }
}

export default XSSProtection;
