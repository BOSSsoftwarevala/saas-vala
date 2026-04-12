import { Request, Response, NextFunction } from 'express';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';

export class SQLInjectionGuard {
  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger
  ) {}

  // SQL injection patterns to detect
  private readonly sqlInjectionPatterns = [
    // Basic SQL injection patterns
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|WHERE|FROM|INTO|TABLE|DATABASE)\b)/gi,
    // SQL comments
    /(--|#|\/\*|\*\/)/,
    // Union-based attacks
    /\bUNION\s+SELECT\b/gi,
    // Boolean-based attacks
    /\bAND\s+\d+\s*=\s*\d+|\bOR\s+\d+\s*=\s*\d+/gi,
    // Time-based attacks
    /\b(SLEEP|WAITFOR|DELAY|BENCHMARK)\b/gi,
    // Error-based attacks
    /\b(EXTRACTVALUE|UPDATEXML|FLOOR|RAND)\b/gi,
    // Stacked queries
    /;/,
    // Hex encoding
    /0x[0-9a-fA-F]+/,
    // Char encoding
    /\bCHAR\s*\(/gi,
    // Concatenation attacks
    /\b(CONCAT|CONCAT_WS|GROUP_CONCAT)\b/gi,
    // Information schema
    /\b(INFORMATION_SCHEMA|SYS|MASTER|MSDB)\b/gi,
    // Load file attacks
    /\bLOAD_FILE\s*\(/gi,
    // Into outfile attacks
    /\bINTO\s+OUTFILE\b/gi
  ];

  // Detect SQL injection in input
  detectSQLInjection(input: string): boolean {
    if (typeof input !== 'string') {
      return false;
    }

    return this.sqlInjectionPatterns.some(pattern => pattern.test(input));
  }

  // Middleware to detect and block SQL injection attempts
  blockSQLInjection = (req: Request, res: Response, next: NextFunction) => {
    const checkValue = (value: any, path: string = ''): boolean => {
      if (typeof value === 'string') {
        if (this.detectSQLInjection(value)) {
          this.logger.warn('SQL injection attempt detected', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path,
            method: req.method,
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
    const hasSQLInjection = 
      checkValue(req.body, 'body') ||
      checkValue(req.query, 'query') ||
      checkValue(req.params, 'params');

    if (hasSQLInjection) {
      return res.status(400).json({
        error: 'Invalid input detected',
        code: 'SQL_INJECTION_DETECTED'
      });
    }

    next();
  };

  // Safe query wrapper that only allows parameterized queries
  async safeQuery(sql: string, params: any[] = []): Promise<any> {
    // Validate that the query uses parameter placeholders
    if (!this.validateParameterizedQuery(sql)) {
      this.logger.error('Non-parameterized query attempted', { sql: sql.substring(0, 100) });
      throw new Error('Only parameterized queries are allowed');
    }

    // Validate parameter count matches placeholders
    const placeholderCount = (sql.match(/\$\d+/g) || []).length;
    if (placeholderCount !== params.length) {
      this.logger.error('Parameter count mismatch', {
        sql: sql.substring(0, 100),
        placeholderCount,
        paramCount: params.length
      });
      throw new Error('Parameter count does not match placeholders');
    }

    try {
      const result = await this.db.query(sql, params);
      return result;
    } catch (error: any) {
      this.logger.error('Safe query failed', {
        error: error.message,
        sql: sql.substring(0, 100)
      });
      throw error;
    }
  }

  // Validate that query uses parameterized format
  private validateParameterizedQuery(sql: string): boolean {
    // Check for dangerous patterns that indicate non-parameterized queries
    const dangerousPatterns = [
      // Direct value insertion
      /=\s*['"]\w*['"]/,
      /=\s*\d+/,
      // String concatenation
      /['"]\s*\+\s*['"]/,
      // Dynamic SQL building
      /\bEXEC\s*\(/gi,
      /\bEXECUTE\s*\(/gi,
      /\bSP_EXECUTESQL\b/gi
    ];

    // Allow only PostgreSQL parameterized format ($1, $2, etc.)
    const validParameterPattern = /^\$[1-9]\d*$/;

    // Extract all potential values from the query
    const values = sql.match(/(['"])(?:\\.|(?!\1)[^\\\r\n])*\1|(\b\d+\b)/g) || [];

    for (const value of values) {
      // Skip if it's a parameter placeholder
      if (validParameterPattern.test(value.trim())) {
        continue;
      }

      // Check if it's a dangerous pattern
      for (const pattern of dangerousPatterns) {
        if (pattern.test(sql)) {
          return false;
        }
      }
    }

    return true;
  }

  // Sanitize input for safe database operations
  sanitizeInput(input: any): any {
    if (input === null || input === undefined) {
      return input;
    }

    if (typeof input === 'string') {
      // Remove potential SQL injection patterns
      return input
        .replace(/['"]/g, '')
        .replace(/--|#|\/\*|\*\/|;/g, '')
        .replace(/\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|WHERE|FROM|INTO|TABLE|DATABASE)\b/gi, '')
        .trim();
    }

    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }

    if (typeof input === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return input;
  }

  // Validate table and column names to prevent injection
  validateIdentifier(identifier: string): boolean {
    // Only allow alphanumeric characters and underscores
    const validIdentifierPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
    
    // Check against SQL keywords
    const sqlKeywords = [
      'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER',
      'FROM', 'WHERE', 'JOIN', 'INNER', 'OUTER', 'LEFT', 'RIGHT',
      'TABLE', 'DATABASE', 'INDEX', 'VIEW', 'PROCEDURE', 'FUNCTION',
      'TRIGGER', 'UNION', 'GROUP', 'ORDER', 'BY', 'HAVING', 'LIMIT',
      'OFFSET', 'AND', 'OR', 'NOT', 'IN', 'EXISTS', 'BETWEEN', 'LIKE',
      'IS', 'NULL', 'TRUE', 'FALSE', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
    ];

    if (!validIdentifierPattern.test(identifier)) {
      return false;
    }

    return !sqlKeywords.includes(identifier.toUpperCase());
  }

  // Build safe WHERE clause
  buildSafeWhereClause(conditions: Record<string, any>): {
    whereClause: string;
    params: any[];
  } {
    const clauses: string[] = [];
    const params: any[] = [];

    for (const [column, value] of Object.entries(conditions)) {
      if (!this.validateIdentifier(column)) {
        throw new Error(`Invalid column name: ${column}`);
      }

      if (value === null || value === undefined) {
        clauses.push(`${column} IS NULL`);
      } else if (Array.isArray(value)) {
        const placeholders = value.map((_, index) => `$${params.length + index + 1}`).join(', ');
        clauses.push(`${column} IN (${placeholders})`);
        params.push(...value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle operators like { '>=': 100, '<=': 200 }
        for (const [operator, operatorValue] of Object.entries(value)) {
          switch (operator) {
            case '>':
            case '>=':
            case '<':
            case '<=':
            case '!=':
            case '<>':
              clauses.push(`${column} ${operator} $${params.length + 1}`);
              params.push(operatorValue);
              break;
            case 'LIKE':
              clauses.push(`${column} LIKE $${params.length + 1}`);
              params.push(operatorValue);
              break;
            default:
              throw new Error(`Unsupported operator: ${operator}`);
          }
        }
      } else {
        clauses.push(`${column} = $${params.length + 1}`);
        params.push(value);
      }
    }

    const whereClause = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    return { whereClause, params };
  }

  // Safe pagination helper
  buildSafePagination(page: number = 1, limit: number = 10): {
    limitClause: string;
    offsetClause: string;
    params: number[];
  } {
    // Validate and sanitize pagination parameters
    const safePage = Math.max(1, parseInt(String(page)) || 1);
    const safeLimit = Math.min(100, Math.max(1, parseInt(String(limit)) || 10));
    
    const offset = (safePage - 1) * safeLimit;
    
    return {
      limitClause: `LIMIT $1`,
      offsetClause: `OFFSET $2`,
      params: [safeLimit, offset]
    };
  }

  // Safe ORDER BY clause builder
  buildSafeOrderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): {
    orderByClause: string;
  } {
    if (!this.validateIdentifier(column)) {
      throw new Error(`Invalid column name for sorting: ${column}`);
    }

    const safeDirection = direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    
    return {
      orderByClause: `ORDER BY ${column} ${safeDirection}`
    };
  }

  // Log SQL injection attempts for monitoring
  async logSQLInjectionAttempt(req: Request, details: {
    field: string;
    value: string;
    pattern: string;
  }): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO security_logs (
          id, event_type, ip_address, user_agent, path, method,
          details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        require('crypto').randomUUID(),
        'SQL_INJECTION_ATTEMPT',
        req.ip,
        req.get('User-Agent') || '',
        req.path,
        req.method,
        JSON.stringify(details)
      ]);
    } catch (error: any) {
      this.logger.error('Failed to log SQL injection attempt', { error: error.message });
    }
  }

  // Check for SQL injection in file uploads
  validateFileContent(buffer: Buffer, filename: string): {
    safe: boolean;
    reason?: string;
  } {
    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
    
    if (this.detectSQLInjection(content)) {
      return {
        safe: false,
        reason: 'File contains SQL injection patterns'
      };
    }

    return { safe: true };
  }
}

export default SQLInjectionGuard;
