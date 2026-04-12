import { Request, Response, NextFunction } from 'express';
import { UltraDatabase } from '../database';
import { UltraLogger } from '../logger';
import crypto from 'crypto';
import path from 'path';

export interface FileUploadConfig {
  maxFileSize: number; // bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  scanForMalware: boolean;
  quarantineSuspicious: boolean;
}

export interface ScanResult {
  safe: boolean;
  reason?: string;
  threats?: string[];
  cleaned?: boolean;
}

export class FileUploadSecurity {
  private readonly dangerousExtensions = [
    '.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar',
    '.app', '.deb', '.pkg', '.dmg', '.rpm', '.msi', '.dll', '.so', '.dylib',
    '.ps1', '.sh', '.py', '.pl', '.rb', '.php', '.asp', '.aspx', '.jsp',
    '.swf', '.fla', '.action', '.class', '.war', '.ear', '.apk', '.ipa'
  ];

  private readonly dangerousMimeTypes = [
    'application/x-executable',
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-sh',
    'application/x-shellscript',
    'application/x-python-code',
    'application/x-perl',
    'application/x-php',
    'application/x-javascript',
    'application/java-archive',
    'application/vnd.android.package-archive',
    'application/x-apple-diskimage'
  ];

  private readonly malwareSignatures = [
    // Common malware patterns (simplified)
    Buffer.from([0x4D, 0x5A]), // PE executable
    Buffer.from([0x7F, 0x45, 0x4C, 0x46]), // ELF executable
    Buffer.from([0xCA, 0xFE, 0xBA, 0xBE]), // Java class
    Buffer.from([0x50, 0x4B, 0x03, 0x04]), // ZIP (can contain executables)
    Buffer.from([0x50, 0x4B, 0x05, 0x06]), // ZIP archive
    Buffer.from([0x50, 0x4B, 0x07, 0x08]), // ZIP spanned
  ];

  constructor(
    private db: UltraDatabase,
    private logger: UltraLogger
  ) {}

  // Default configuration for different file types
  private readonly configs: Record<string, FileUploadConfig> = {
    image: {
      maxFileSize: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
      scanForMalware: true,
      quarantineSuspicious: true
    },
    document: {
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
        'text/csv'
      ],
      allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'],
      scanForMalware: true,
      quarantineSuspicious: true
    },
    apk: {
      maxFileSize: 100 * 1024 * 1024, // 100MB
      allowedMimeTypes: [
        'application/vnd.android.package-archive',
        'application/octet-stream'
      ],
      allowedExtensions: ['.apk'],
      scanForMalware: true,
      quarantineSuspicious: true
    },
    general: {
      maxFileSize: 25 * 1024 * 1024, // 25MB
      allowedMimeTypes: [],
      allowedExtensions: [],
      scanForMalware: true,
      quarantineSuspicious: true
    }
  };

  // Middleware to secure file uploads
  secureFileUpload = (fileType: keyof typeof this.configs = 'general') => {
    const config = this.configs[fileType];

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.file && !req.files) {
          return next();
        }

        const files = Array.isArray(req.files) ? req.files : 
                     req.files ? Object.values(req.files).flat() : 
                     req.file ? [req.file] : [];

        const results = await Promise.all(
          files.map(file => this.validateFile(file, config))
        );

        const failedFiles = results.filter(result => !result.safe);
        
        if (failedFiles.length > 0) {
          const reasons = failedFiles.map(f => f.reason).filter(Boolean);
          
          this.logger.warn('File upload security violation', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            fileType,
            reasons,
            fileCount: files.length
          });

          // Log security event
          await this.logSecurityEvent(req, 'FILE_UPLOAD_VIOLATION', {
            fileType,
            reasons,
            fileCount: files.length
          });

          return res.status(400).json({
            error: 'File upload blocked',
            code: 'FILE_SECURITY_VIOLATION',
            reasons
          });
        }

        // Add security metadata to files
        files.forEach((file, index) => {
          (file as any).securityMetadata = {
            scanned: true,
            scanResult: results[index],
            scannedAt: new Date()
          };
        });

        next();
      } catch (error: any) {
        this.logger.error('File upload security error', { error: error.message });
        res.status(500).json({
          error: 'File upload security error',
          code: 'FILE_SECURITY_ERROR'
        });
      }
    };
  };

  // Validate individual file
  async validateFile(file: Express.Multer.File, config: FileUploadConfig): Promise<ScanResult> {
    const results: ScanResult = { safe: true };

    // 1. Check file size
    if (file.size > config.maxFileSize) {
      return {
        safe: false,
        reason: `File size ${file.size} exceeds maximum ${config.maxFileSize}`
      };
    }

    // 2. Check file extension
    const ext = path.extname(file.originalname).toLowerCase();
    if (config.allowedExtensions.length > 0 && !config.allowedExtensions.includes(ext)) {
      return {
        safe: false,
        reason: `File extension ${ext} not allowed`
      };
    }

    // 3. Check for dangerous extensions
    if (this.dangerousExtensions.includes(ext)) {
      return {
        safe: false,
        reason: `Dangerous file extension ${ext}`
      };
    }

    // 4. Check MIME type
    if (config.allowedMimeTypes.length > 0 && !config.allowedMimeTypes.includes(file.mimetype)) {
      return {
        safe: false,
        reason: `MIME type ${file.mimetype} not allowed`
      };
    }

    // 5. Check for dangerous MIME types
    if (this.dangerousMimeTypes.includes(file.mimetype)) {
      return {
        safe: false,
        reason: `Dangerous MIME type ${file.mimetype}`
      };
    }

    // 6. Verify MIME type matches file content
    const detectedMime = await this.detectMimeType(file.buffer);
    if (detectedMime !== file.mimetype && !this.isMimeMismatchAllowed(file.mimetype, detectedMime)) {
      return {
        safe: false,
        reason: `MIME type mismatch: declared ${file.mimetype}, detected ${detectedMime}`
      };
    }

    // 7. Scan for malware signatures
    if (config.scanForMalware) {
      const malwareScan = await this.scanForMalware(file.buffer, file.originalname);
      if (!malwareScan.safe) {
        return malwareScan;
      }
    }

    // 8. Check for embedded scripts in safe file types
    if (['image/jpeg', 'image/png', 'image/gif'].includes(file.mimetype)) {
      const scriptCheck = this.checkForEmbeddedScripts(file.buffer);
      if (!scriptCheck.safe) {
        return scriptCheck;
      }
    }

    // 9. Validate filename
    const filenameCheck = this.validateFilename(file.originalname);
    if (!filenameCheck.safe) {
      return filenameCheck;
    }

    return results;
  }

  // Detect actual MIME type from file content
  private async detectMimeType(buffer: Buffer): Promise<string> {
    // Check file signatures
    if (buffer.length < 4) return 'application/octet-stream';

    const signature = buffer.subarray(0, 12);

    // Image signatures
    if (signature[0] === 0xFF && signature[1] === 0xD8 && signature[2] === 0xFF) {
      return 'image/jpeg';
    }
    if (signature[0] === 0x89 && signature[1] === 0x50 && signature[2] === 0x4E && signature[3] === 0x47) {
      return 'image/png';
    }
    if (signature[0] === 0x47 && signature[1] === 0x49 && signature[2] === 0x46) {
      return 'image/gif';
    }
    if (signature[8] === 0x57 && signature[9] === 0x45 && signature[10] === 0x42 && signature[11] === 0x50) {
      return 'image/webp';
    }

    // PDF signature
    if (signature[0] === 0x25 && signature[1] === 0x50 && signature[2] === 0x44 && signature[3] === 0x46) {
      return 'application/pdf';
    }

    // ZIP signatures (Office docs, APKs)
    if (signature[0] === 0x50 && signature[1] === 0x4B && (signature[2] === 0x03 || signature[2] === 0x05 || signature[2] === 0x07)) {
      // Further inspection needed for specific ZIP types
      if (this.isAPKSignature(buffer)) {
        return 'application/vnd.android.package-archive';
      }
      return 'application/zip';
    }

    return 'application/octet-stream';
  }

  // Check if file is APK
  private isAPKSignature(buffer: Buffer): boolean {
    // APK is a ZIP file with specific structure
    if (buffer.length < 100) return false;
    
    // Look for AndroidManifest.xml in ZIP
    const content = buffer.toString('utf8', 30, Math.min(100, buffer.length));
    return content.includes('AndroidManifest.xml') || content.includes('META-INF');
  }

  // Check if MIME type mismatch is allowed
  private isMimeMismatchAllowed(declared: string, detected: string): boolean {
    // Allow generic octet-stream for some types
    if (declared === 'application/octet-stream') return true;
    
    // Allow zip mismatch for office docs and APKs
    const zipTypes = ['application/vnd.openxmlformats-officedocument.*', 'application/vnd.android.package-archive'];
    return zipTypes.some(pattern => declared.match(pattern));
  }

  // Scan for malware signatures
  private async scanForMalware(buffer: Buffer, filename: string): Promise<ScanResult> {
    const threats: string[] = [];

    // Check against known malware signatures
    for (const signature of this.malwareSignatures) {
      if (buffer.subarray(0, signature.length).equals(signature)) {
        threats.push('Known executable signature detected');
      }
    }

    // Check for suspicious patterns
    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
    
    // Suspicious strings
    const suspiciousPatterns = [
      /eval\s*\(/gi,
      /<script/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /powershell/gi,
      /cmd\.exe/gi,
      /\/bin\/bash/gi,
      /system\s*\(/gi,
      /exec\s*\(/gi
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(content)) {
        threats.push(`Suspicious pattern detected: ${pattern.source}`);
      }
    }

    // Check for double extensions (e.g., file.jpg.exe)
    const parts = filename.split('.');
    if (parts.length > 2) {
      const lastExt = parts[parts.length - 1].toLowerCase();
      const secondLastExt = parts[parts.length - 2].toLowerCase();
      
      if (this.dangerousExtensions.includes(`.${lastExt}`) && 
          ['.jpg', '.png', '.gif', '.pdf', '.txt'].includes(`.${secondLastExt}`)) {
        threats.push('Double extension detected - possible disguise');
      }
    }

    return {
      safe: threats.length === 0,
      threats: threats.length > 0 ? threats : undefined
    };
  }

  // Check for embedded scripts in images
  private checkForEmbeddedScripts(buffer: Buffer): ScanResult {
    const content = buffer.toString('utf8', 0, Math.min(2048, buffer.length));
    
    const scriptPatterns = [
      /<script/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /<iframe/gi,
      /<object/gi,
      /<embed/gi
    ];

    for (const pattern of scriptPatterns) {
      if (pattern.test(content)) {
        return {
          safe: false,
          reason: `Embedded script detected in image: ${pattern.source}`
        };
      }
    }

    return { safe: true };
  }

  // Validate filename
  private validateFilename(filename: string): ScanResult {
    // Check for dangerous characters
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      return {
        safe: false,
        reason: 'Filename contains dangerous characters'
      };
    }

    // Check for path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return {
        safe: false,
        reason: 'Path traversal detected in filename'
      };
    }

    // Check length
    if (filename.length > 255) {
      return {
        safe: false,
        reason: 'Filename too long'
      };
    }

    return { safe: true };
  }

  // Generate secure filename
  generateSecureFilename(originalName: string): string {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    
    // Sanitize name
    const sanitizedName = name
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 50); // Limit length
    
    // Add timestamp and random suffix
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    
    return `${sanitizedName}_${timestamp}_${random}${ext}`;
  }

  // Log security events
  private async logSecurityEvent(req: Request, eventType: string, details: any): Promise<void> {
    try {
      await this.db.query(`
        INSERT INTO security_logs (
          id, event_type, ip_address, user_agent, path, method,
          details, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      `, [
        crypto.randomUUID(),
        eventType,
        req.ip,
        req.get('User-Agent') || '',
        req.path,
        req.method,
        JSON.stringify(details)
      ]);
    } catch (error: any) {
      this.logger.error('Failed to log security event', { error: error.message });
    }
  }

  // Get file upload statistics
  async getUploadStatistics(timeframe: number = 24 * 60 * 60 * 1000): Promise<{
    totalUploads: number;
    blockedUploads: number;
    topFileTypes: Array<{ type: string; count: number }>;
    topViolations: Array<{ reason: string; count: number }>;
  }> {
    try {
      const since = new Date(Date.now() - timeframe);
      
      const result = await this.db.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN details LIKE '%"blocked":true%' THEN 1 END) as blocked
        FROM security_logs 
        WHERE event_type = 'FILE_UPLOAD_VIOLATION' 
        AND created_at > $1
      `, [since]);

      // Get detailed statistics (simplified)
      return {
        totalUploads: parseInt(result.rows[0]?.total || '0'),
        blockedUploads: parseInt(result.rows[0]?.blocked || '0'),
        topFileTypes: [],
        topViolations: []
      };
    } catch (error: any) {
      this.logger.error('Failed to get upload statistics', { error: error.message });
      return {
        totalUploads: 0,
        blockedUploads: 0,
        topFileTypes: [],
        topViolations: []
      };
    }
  }
}

export default FileUploadSecurity;
