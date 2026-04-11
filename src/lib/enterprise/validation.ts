export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid' | 'date' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
  sanitize?: boolean;
}

export interface ValidationSchema {
  name: string;
  rules: ValidationRule[];
  strict?: boolean;
  sanitizeAll?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  data?: any;
  sanitized?: any;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: any;
}

export class ValidationManager {
  private static instance: ValidationManager;
  private schemas: Map<string, ValidationSchema> = new Map();

  static getInstance(): ValidationManager {
    if (!ValidationManager.instance) {
      ValidationManager.instance = new ValidationManager();
    }
    return ValidationManager.instance;
  }

  registerSchema(schema: ValidationSchema): void {
    this.schemas.set(schema.name, schema);
  }

  async validate(schemaName: string, data: any, options: { strict?: boolean; sanitize?: boolean } = {}): Promise<ValidationResult> {
    const schema = this.schemas.get(schemaName);
    if (!schema) {
      throw new Error(`Validation schema '${schemaName}' not found`);
    }

    const isStrict = options.strict ?? schema.strict ?? false;
    const shouldSanitize = options.sanitize ?? schema.sanitizeAll ?? false;

    const errors: ValidationError[] = [];
    const sanitized = shouldSanitize ? {} : undefined;
    const validated = {};

    // Check for unexpected fields in strict mode
    if (isStrict) {
      const allowedFields = schema.rules.map(rule => rule.field);
      const unexpectedFields = Object.keys(data).filter(key => !allowedFields.includes(key));
      
      for (const field of unexpectedFields) {
        errors.push({
          field,
          message: `Unexpected field '${field}'`,
          code: 'UNEXPECTED_FIELD',
          value: data[field],
        });
      }
    }

    // Validate each field
    for (const rule of schema.rules) {
      const value = data[rule.field];
      const fieldResult = await this.validateField(rule, value, data);
      
      if (!fieldResult.valid) {
        errors.push(...fieldResult.errors);
      } else {
        validated[rule.field] = fieldResult.value;
        if (shouldSanitize && sanitized) {
          sanitized[rule.field] = fieldResult.sanitized || fieldResult.value;
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      data: errors.length === 0 ? validated : undefined,
      sanitized,
    };
  }

  async validateField(rule: ValidationRule, value: any, context: any = {}): Promise<{ valid: boolean; errors: ValidationError[]; value: any; sanitized?: any }> {
    const errors: ValidationError[] = [];
    let processedValue = value;
    let sanitized: any;

    // Check if required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push({
        field: rule.field,
        message: `Field '${rule.field}' is required`,
        code: 'REQUIRED',
        value,
      });
      return { valid: false, errors, value };
    }

    // Skip validation if not required and value is empty
    if (!rule.required && (value === undefined || value === null || value === '')) {
      return { valid: true, errors: [], value };
    }

    // Type validation
    const typeResult = this.validateType(rule.type, processedValue);
    if (!typeResult.valid) {
      errors.push({
        field: rule.field,
        message: typeResult.message,
        code: 'INVALID_TYPE',
        value: processedValue,
      });
      return { valid: false, errors, value };
    }
    processedValue = typeResult.value;

    // Sanitization
    if (rule.sanitize) {
      sanitized = this.sanitizeValue(processedValue, rule.type);
    }

    // Length validation for strings
    if (rule.type === 'string' && typeof processedValue === 'string') {
      if (rule.minLength !== undefined && processedValue.length < rule.minLength) {
        errors.push({
          field: rule.field,
          message: `Field '${rule.field}' must be at least ${rule.minLength} characters long`,
          code: 'MIN_LENGTH',
          value: processedValue,
        });
      }

      if (rule.maxLength !== undefined && processedValue.length > rule.maxLength) {
        errors.push({
          field: rule.field,
          message: `Field '${rule.field}' must not exceed ${rule.maxLength} characters`,
          code: 'MAX_LENGTH',
          value: processedValue,
        });
      }
    }

    // Range validation for numbers
    if (rule.type === 'number' && typeof processedValue === 'number') {
      if (rule.min !== undefined && processedValue < rule.min) {
        errors.push({
          field: rule.field,
          message: `Field '${rule.field}' must be at least ${rule.min}`,
          code: 'MIN_VALUE',
          value: processedValue,
        });
      }

      if (rule.max !== undefined && processedValue > rule.max) {
        errors.push({
          field: rule.field,
          message: `Field '${rule.field}' must not exceed ${rule.max}`,
          code: 'MAX_VALUE',
          value: processedValue,
        });
      }
    }

    // Pattern validation
    if (rule.pattern && typeof processedValue === 'string') {
      if (!rule.pattern.test(processedValue)) {
        errors.push({
          field: rule.field,
          message: `Field '${rule.field}' does not match required pattern`,
          code: 'INVALID_PATTERN',
          value: processedValue,
        });
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(processedValue)) {
      errors.push({
        field: rule.field,
        message: `Field '${rule.field}' must be one of: ${rule.enum.join(', ')}`,
        code: 'INVALID_ENUM',
        value: processedValue,
      });
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(processedValue);
      if (customResult !== true) {
        errors.push({
          field: rule.field,
          message: typeof customResult === 'string' ? customResult : `Field '${rule.field}' failed custom validation`,
          code: 'CUSTOM_VALIDATION',
          value: processedValue,
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      value: processedValue,
      sanitized,
    };
  }

  private validateType(type: ValidationRule['type'], value: any): { valid: boolean; message?: string; value: any } {
    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, message: `Expected string, got ${typeof value}`, value };
        }
        return { valid: true, value };

      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          const numValue = Number(value);
          if (isNaN(numValue)) {
            return { valid: false, message: `Expected number, got ${typeof value}`, value };
          }
          return { valid: true, value: numValue };
        }
        return { valid: true, value };

      case 'boolean':
        if (typeof value !== 'boolean') {
          if (value === 'true' || value === '1') return { valid: true, value: true };
          if (value === 'false' || value === '0') return { valid: true, value: false };
          return { valid: false, message: `Expected boolean, got ${typeof value}`, value };
        }
        return { valid: true, value };

      case 'email':
        if (typeof value !== 'string') {
          return { valid: false, message: `Expected email string, got ${typeof value}`, value };
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          return { valid: false, message: `Invalid email format`, value };
        }
        return { valid: true, value: value.toLowerCase() };

      case 'url':
        if (typeof value !== 'string') {
          return { valid: false, message: `Expected URL string, got ${typeof value}`, value };
        }
        try {
          new URL(value);
          return { valid: true, value };
        } catch {
          return { valid: false, message: `Invalid URL format`, value };
        }

      case 'uuid':
        if (typeof value !== 'string') {
          return { valid: false, message: `Expected UUID string, got ${typeof value}`, value };
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(value)) {
          return { valid: false, message: `Invalid UUID format`, value };
        }
        return { valid: true, value };

      case 'date':
        if (value instanceof Date) {
          return { valid: true, value };
        }
        if (typeof value === 'string') {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            return { valid: false, message: `Invalid date format`, value };
          }
          return { valid: true, value: date };
        }
        return { valid: false, message: `Expected date, got ${typeof value}`, value };

      case 'array':
        if (!Array.isArray(value)) {
          return { valid: false, message: `Expected array, got ${typeof value}`, value };
        }
        return { valid: true, value };

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return { valid: false, message: `Expected object, got ${typeof value}`, value };
        }
        return { valid: true, value };

      default:
        return { valid: false, message: `Unknown type: ${type}`, value };
    }
  }

  private sanitizeValue(value: any, type: ValidationRule['type']): any {
    if (typeof value !== 'string') return value;

    switch (type) {
      case 'string':
        return value.trim().replace(/\s+/g, ' ');
      
      case 'email':
        return value.toLowerCase().trim();
      
      case 'url':
        return value.trim();
      
      default:
        return value;
    }
  }

  getSchema(name: string): ValidationSchema | undefined {
    return this.schemas.get(name);
  }

  removeSchema(name: string): boolean {
    return this.schemas.delete(name);
  }

  clearSchemas(): void {
    this.schemas.clear();
  }
}

// Predefined validation schemas
export const COMMON_SCHEMAS: ValidationSchema[] = [
  {
    name: 'user_registration',
    rules: [
      {
        field: 'email',
        type: 'email',
        required: true,
        sanitize: true,
      },
      {
        field: 'password',
        type: 'string',
        required: true,
        minLength: 8,
        maxLength: 128,
        pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
        custom: (value) => {
          if (!/(?=.*[a-z])/.test(value)) return 'Password must contain at least one lowercase letter';
          if (!/(?=.*[A-Z])/.test(value)) return 'Password must contain at least one uppercase letter';
          if (!/(?=.*\d)/.test(value)) return 'Password must contain at least one number';
          if (!/(?=.*[@$!%*?&])/.test(value)) return 'Password must contain at least one special character';
          return true;
        },
      },
      {
        field: 'firstName',
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 50,
        sanitize: true,
      },
      {
        field: 'lastName',
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 50,
        sanitize: true,
      },
    ],
    strict: true,
    sanitizeAll: true,
  },

  {
    name: 'product_creation',
    rules: [
      {
        field: 'name',
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 100,
        sanitize: true,
      },
      {
        field: 'description',
        type: 'string',
        required: true,
        minLength: 10,
        maxLength: 1000,
        sanitize: true,
      },
      {
        field: 'price',
        type: 'number',
        required: true,
        min: 0,
        max: 999999.99,
      },
      {
        field: 'category',
        type: 'string',
        required: true,
        enum: ['software', 'service', 'template', 'tool', 'other'],
      },
      {
        field: 'tags',
        type: 'array',
        required: false,
        custom: (value) => {
          if (!Array.isArray(value)) return 'Tags must be an array';
          if (value.length > 10) return 'Maximum 10 tags allowed';
          if (value.some(tag => typeof tag !== 'string' || tag.length > 20)) {
            return 'All tags must be strings with max 20 characters';
          }
          return true;
        },
      },
    ],
    strict: true,
  },

  {
    name: 'api_key_generation',
    rules: [
      {
        field: 'productId',
        type: 'uuid',
        required: true,
      },
      {
        field: 'name',
        type: 'string',
        required: true,
        minLength: 1,
        maxLength: 50,
        sanitize: true,
      },
      {
        field: 'expiresAt',
        type: 'date',
        required: false,
        custom: (value) => {
          if (value && value <= new Date()) {
            return 'Expiry date must be in the future';
          }
          return true;
        },
      },
      {
        field: 'permissions',
        type: 'array',
        required: false,
        custom: (value) => {
          if (!Array.isArray(value)) return 'Permissions must be an array';
          const validPerms = ['read', 'write', 'admin'];
          if (value.some(perm => !validPerms.includes(perm))) {
            return `Invalid permissions. Allowed: ${validPerms.join(', ')}`;
          }
          return true;
        },
      },
    ],
    strict: true,
  },
];

// Initialize common schemas
export function initializeValidationSchemas(): void {
  const validator = ValidationManager.getInstance();
  COMMON_SCHEMAS.forEach(schema => validator.registerSchema(schema));
}
