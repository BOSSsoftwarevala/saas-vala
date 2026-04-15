// File Validation Service - Validate file types and sizes
export interface FileValidationConfig {
  maxSize: number; // in bytes
  allowedTypes: string[];
  allowedExtensions: string[];
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: {
    size: number;
    type: string;
    extension: string;
  };
}

class FileValidationService {
  private static instance: FileValidationService;
  private configs: Map<string, FileValidationConfig> = new Map();

  private constructor() {
    // Initialize default configurations
    this.configs.set('apk', {
      maxSize: 100 * 1024 * 1024, // 100MB
      allowedTypes: ['application/vnd.android.package-archive', 'application/zip'],
      allowedExtensions: ['.apk'],
    });

    this.configs.set('image', {
      maxSize: 5 * 1024 * 1024, // 5MB
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
    });

    this.configs.set('document', {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      allowedExtensions: ['.pdf', '.doc', '.docx'],
    });

    this.configs.set('video', {
      maxSize: 500 * 1024 * 1024, // 500MB
      allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
      allowedExtensions: ['.mp4', '.webm', '.mov'],
    });
  }

  static getInstance(): FileValidationService {
    if (!FileValidationService.instance) {
      FileValidationService.instance = new FileValidationService();
    }
    return FileValidationService.instance;
  }

  setConfig(key: string, config: FileValidationConfig): void {
    this.configs.set(key, config);
  }

  getConfig(key: string): FileValidationConfig | undefined {
    return this.configs.get(key);
  }

  validateFile(file: File, configKey: string): ValidationResult {
    const config = this.configs.get(configKey);
    
    if (!config) {
      return {
        valid: false,
        error: `Configuration not found for: ${configKey}`,
      };
    }

    // Check file size
    if (file.size > config.maxSize) {
      const maxSizeMB = config.maxSize / (1024 * 1024);
      return {
        valid: false,
        error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`,
        details: {
          size: file.size,
          type: file.type,
          extension: this.getFileExtension(file.name),
        },
      };
    }

    // Check file type
    if (!config.allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: `File type not allowed. Allowed types: ${config.allowedTypes.join(', ')}`,
        details: {
          size: file.size,
          type: file.type,
          extension: this.getFileExtension(file.name),
        },
      };
    }

    // Check file extension
    const extension = this.getFileExtension(file.name).toLowerCase();
    if (!config.allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `File extension not allowed. Allowed extensions: ${config.allowedExtensions.join(', ')}`,
        details: {
          size: file.size,
          type: file.type,
          extension,
        },
      };
    }

    return {
      valid: true,
      details: {
        size: file.size,
        type: file.type,
        extension,
      },
    };
  }

  validateAPK(file: File): ValidationResult {
    return this.validateFile(file, 'apk');
  }

  validateImage(file: File): ValidationResult {
    return this.validateFile(file, 'image');
  }

  validateDocument(file: File): ValidationResult {
    return this.validateFile(file, 'document');
  }

  validateVideo(file: File): ValidationResult {
    return this.validateFile(file, 'video');
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1].toLowerCase()}` : '';
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  async validateFileContent(file: File, configKey: string): Promise<ValidationResult> {
    const basicValidation = this.validateFile(file, configKey);
    
    if (!basicValidation.valid) {
      return basicValidation;
    }

    // Additional content validation for specific file types
    if (configKey === 'apk') {
      return this.validateAPKContent(file);
    }

    return basicValidation;
  }

  private async validateAPKContent(file: File): Promise<ValidationResult> {
    // Read file header to verify it's a valid APK
    const header = await this.readFileHeader(file, 4);
    
    // APK files start with PK (ZIP format)
    if (header !== 'PK\x03\x04') {
      return {
        valid: false,
        error: 'Invalid APK file format',
        details: {
          size: file.size,
          type: file.type,
          extension: this.getFileExtension(file.name),
        },
      };
    }

    return {
      valid: true,
      details: {
        size: file.size,
        type: file.type,
        extension: this.getFileExtension(file.name),
      },
    };
  }

  private readFileHeader(file: File, bytes: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const arrayBuffer = e.target.result as ArrayBuffer;
          const uint8Array = new Uint8Array(arrayBuffer);
          const header = String.fromCharCode.apply(null, Array.from(uint8Array.slice(0, bytes)));
          resolve(header);
        } else {
          reject(new Error('Failed to read file header'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file.slice(0, bytes));
    });
  }
}

export const fileValidationService = FileValidationService.getInstance();

// Convenience functions
export function validateAPK(file: File): ValidationResult {
  return fileValidationService.validateAPK(file);
}

export function validateImage(file: File): ValidationResult {
  return fileValidationService.validateImage(file);
}

export function formatFileSize(bytes: number): string {
  return fileValidationService.formatFileSize(bytes);
}
