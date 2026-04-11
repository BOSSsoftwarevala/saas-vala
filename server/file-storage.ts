import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { UltraLogger } from './logger';
import { UltraDatabase } from './database';
import { UltraAdvancedCache } from './advanced-cache';

export interface FileStorageConfig {
  uploadPath: string;
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  allowedExtensions: string[];
  virusScanning: {
    enabled: boolean;
    scanner: 'clamav' | 'custom';
    customCommand?: string;
  };
  encryption: {
    enabled: boolean;
    algorithm: string;
    key: string;
  };
  compression: {
    enabled: boolean;
    threshold: number; // in bytes
  };
  cdn: {
    enabled: boolean;
    provider: 'aws-s3' | 'cloudflare-r2' | 'local';
    bucket?: string;
    region?: string;
    endpoint?: string;
  };
  retention: {
    enabled: boolean;
    defaultDays: number;
    cleanupInterval: number; // in hours
  };
}

export interface UploadedFile {
  id: string;
  originalName: string;
  filename: string;
  mimeType: string;
  size: number;
  path: string;
  hash: string;
  uploadedAt: Date;
  uploadedBy: string;
  metadata: any;
  encrypted: boolean;
  compressed: boolean;
  virusScanned: boolean;
  virusClean: boolean;
  cdnUrl?: string;
  expiresAt?: Date;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export class UltraFileStorage extends EventEmitter {
  private static instance: UltraFileStorage;
  private logger: UltraLogger;
  private database: UltraDatabase;
  private cache: UltraAdvancedCache;
  private config: FileStorageConfig;

  static getInstance(config?: FileStorageConfig): UltraFileStorage {
    if (!UltraFileStorage.instance) {
      UltraFileStorage.instance = new UltraFileStorage(config);
    }
    return UltraFileStorage.instance;
  }

  constructor(config?: FileStorageConfig) {
    super();
    this.logger = UltraLogger.getInstance();
    this.database = UltraDatabase.getInstance();
    this.cache = UltraAdvancedCache.getInstance();
    
    this.config = {
      uploadPath: process.env.FILE_UPLOAD_PATH || '/var/uploads',
      maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600'), // 100MB
      allowedMimeTypes: (process.env.ALLOWED_MIME_TYPES || 'image/jpeg,image/png,image/gif,application/pdf,text/plain,application/json').split(','),
      allowedExtensions: (process.env.ALLOWED_EXTENSIONS || 'jpg,jpeg,png,gif,pdf,txt,json').split(','),
      virusScanning: {
        enabled: process.env.VIRUS_SCANNING_ENABLED === 'true',
        scanner: (process.env.VIRUS_SCANNER as any) || 'clamav',
        customCommand: process.env.VIRUS_SCANNER_CUSTOM_COMMAND
      },
      encryption: {
        enabled: process.env.FILE_ENCRYPTION_ENABLED === 'true',
        algorithm: process.env.FILE_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
        key: process.env.FILE_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex')
      },
      compression: {
        enabled: process.env.FILE_COMPRESSION_ENABLED !== 'false',
        threshold: parseInt(process.env.FILE_COMPRESSION_THRESHOLD || '10240') // 10KB
      },
      cdn: {
        enabled: process.env.CDN_ENABLED === 'true',
        provider: (process.env.CDN_PROVIDER as any) || 'local',
        bucket: process.env.CDN_BUCKET,
        region: process.env.CDN_REGION,
        endpoint: process.env.CDN_ENDPOINT
      },
      retention: {
        enabled: process.env.FILE_RETENTION_ENABLED !== 'false',
        defaultDays: parseInt(process.env.FILE_RETENTION_DEFAULT_DAYS || '30'),
        cleanupInterval: parseInt(process.env.FILE_RETENTION_CLEANUP_INTERVAL || '24')
      },
      ...config
    };

    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      // Ensure upload directory exists
      if (!fs.existsSync(this.config.uploadPath)) {
        fs.mkdirSync(this.config.uploadPath, { recursive: true });
      }

      // Initialize database table
      await this.initializeDatabase();

      // Start retention cleanup if enabled
      if (this.config.retention.enabled) {
        this.startRetentionCleanup();
      }

      this.logger.info('file-storage', 'File storage system initialized', {
        uploadPath: this.config.uploadPath,
        maxFileSize: this.config.maxFileSize,
        virusScanning: this.config.virusScanning.enabled,
        encryption: this.config.encryption.enabled,
        cdn: this.config.cdn.enabled
      });

    } catch (error) {
      this.logger.error('file-storage', 'Failed to initialize file storage', error as Error);
      throw error;
    }
  }

  private async initializeDatabase(): Promise<void> {
    await this.database.query(`
      CREATE TABLE IF NOT EXISTS uploaded_files (
        id VARCHAR(255) PRIMARY KEY,
        original_name VARCHAR(500) NOT NULL,
        filename VARCHAR(500) NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        size BIGINT NOT NULL,
        path VARCHAR(1000) NOT NULL,
        hash VARCHAR(128) NOT NULL,
        uploaded_at TIMESTAMP DEFAULT NOW(),
        uploaded_by VARCHAR(255) NOT NULL,
        metadata JSONB,
        encrypted BOOLEAN DEFAULT FALSE,
        compressed BOOLEAN DEFAULT FALSE,
        virus_scanned BOOLEAN DEFAULT FALSE,
        virus_clean BOOLEAN DEFAULT TRUE,
        cdn_url TEXT,
        expires_at TIMESTAMP
      )
    `);

    await this.database.query('CREATE INDEX IF NOT EXISTS idx_uploaded_files_hash ON uploaded_files(hash)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_uploaded_files_uploaded_by ON uploaded_files(uploaded_by)');
    await this.database.query('CREATE INDEX IF NOT EXISTS idx_uploaded_files_expires_at ON uploaded_files(expires_at)');
  }

  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    mimeType: string,
    uploadedBy: string,
    options: {
      expiresAt?: Date;
      metadata?: any;
      skipVirusScan?: boolean;
    } = {}
  ): Promise<UploadedFile> {
    const fileId = crypto.randomUUID();
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    
    try {
      // Validate file
      const validation = this.validateFile(fileBuffer, originalName, mimeType);
      if (!validation.valid) {
        throw new Error(`File validation failed: ${validation.errors.join(', ')}`);
      }

      // Check for duplicate files
      const existingFile = await this.getFileByHash(fileHash);
      if (existingFile) {
        this.logger.info('file-storage', 'Duplicate file detected, returning existing', { 
          fileId: existingFile.id, 
          originalName 
        });
        return existingFile;
      }

      // Generate unique filename
      const extension = path.extname(originalName);
      const filename = `${fileId}${extension}`;
      const filePath = path.join(this.config.uploadPath, filename);

      let processedBuffer = fileBuffer;
      let encrypted = false;
      let compressed = false;
      let virusClean = true;

      // Compress file if enabled and threshold met
      if (this.config.compression.enabled && fileBuffer.length >= this.config.compression.threshold) {
        processedBuffer = await this.compressFile(fileBuffer);
        compressed = true;
        this.logger.debug('file-storage', `File compressed: ${originalName}`, {
          originalSize: fileBuffer.length,
          compressedSize: processedBuffer.length
        });
      }

      // Encrypt file if enabled
      if (this.config.encryption.enabled) {
        processedBuffer = await this.encryptFile(processedBuffer);
        encrypted = true;
        this.logger.debug('file-storage', `File encrypted: ${originalName}`);
      }

      // Write file to disk
      fs.writeFileSync(filePath, processedBuffer);

      // Virus scanning
      if (this.config.virusScanning.enabled && !options.skipVirusScan) {
        virusClean = await this.scanFile(filePath);
        if (!virusClean) {
          // Delete infected file
          fs.unlinkSync(filePath);
          throw new Error('File failed virus scan');
        }
      }

      // Upload to CDN if enabled
      let cdnUrl: string | undefined;
      if (this.config.cdn.enabled) {
        cdnUrl = await this.uploadToCDN(filePath, filename, mimeType);
      }

      // Create file record
      const uploadedFile: UploadedFile = {
        id: fileId,
        originalName,
        filename,
        mimeType,
        size: fileBuffer.length,
        path: filePath,
        hash: fileHash,
        uploadedAt: new Date(),
        uploadedBy,
        metadata: options.metadata || {},
        encrypted,
        compressed,
        virusScanned: this.config.virusScanning.enabled,
        virusClean,
        cdnUrl,
        expiresAt: options.expiresAt
      };

      // Save to database
      await this.database.query(`
        INSERT INTO uploaded_files (
          id, original_name, filename, mime_type, size, path, hash, 
          uploaded_by, metadata, encrypted, compressed, virus_scanned, 
          virus_clean, cdn_url, expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      `, [
        uploadedFile.id, uploadedFile.originalName, uploadedFile.filename,
        uploadedFile.mimeType, uploadedFile.size, uploadedFile.path,
        uploadedFile.hash, uploadedFile.uploadedBy, JSON.stringify(uploadedFile.metadata),
        uploadedFile.encrypted, uploadedFile.compressed, uploadedFile.virusScanned,
        uploadedFile.virusClean, uploadedFile.cdnUrl, uploadedFile.expiresAt
      ]);

      // Cache file info
      await this.cache.set(`file:${fileId}`, uploadedFile, { ttl: 3600 });

      this.logger.info('file-storage', `File uploaded successfully: ${originalName}`, {
        fileId,
        size: uploadedFile.size,
        encrypted,
        compressed,
        virusScanned: uploadedFile.virusScanned
      });

      this.emit('fileUploaded', uploadedFile);
      return uploadedFile;

    } catch (error) {
      this.logger.error('file-storage', `Failed to upload file: ${originalName}`, error as Error);
      
      // Cleanup on failure
      try {
        const filePath = path.join(this.config.uploadPath, `${fileId}${path.extname(originalName)}`);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (cleanupError) {
        this.logger.error('file-storage', 'Failed to cleanup file after upload failure', cleanupError as Error);
      }

      throw error;
    }
  }

  async downloadFile(fileId: string, requestedBy?: string): Promise<{
    buffer: Buffer;
    filename: string;
    mimeType: string;
  }> {
    try {
      // Get file info from cache or database
      let fileInfo = await this.cache.get<UploadedFile>(`file:${fileId}`);
      if (!fileInfo) {
        const rows = await this.database.query('SELECT * FROM uploaded_files WHERE id = $1', [fileId]);
        if (rows.length === 0) {
          throw new Error('File not found');
        }
        fileInfo = this.mapRowToFile(rows[0]);
        await this.cache.set(`file:${fileId}`, fileInfo, { ttl: 3600 });
      }

      // Check if file has expired
      if (fileInfo.expiresAt && new Date() > fileInfo.expiresAt) {
        throw new Error('File has expired');
      }

      // Check if file is clean
      if (!fileInfo.virusClean) {
        throw new Error('File is not safe for download');
      }

      // Get file buffer
      let fileBuffer: Buffer;
      
      if (this.config.cdn.enabled && fileInfo.cdnUrl) {
        fileBuffer = await this.downloadFromCDN(fileInfo.cdnUrl);
      } else {
        if (!fs.existsSync(fileInfo.path)) {
          throw new Error('File not found on disk');
        }
        fileBuffer = fs.readFileSync(fileInfo.path);
      }

      // Decrypt if needed
      if (fileInfo.encrypted) {
        fileBuffer = await this.decryptFile(fileBuffer);
      }

      // Decompress if needed
      if (fileInfo.compressed) {
        fileBuffer = await this.decompressFile(fileBuffer);
      }

      // Log download
      this.logger.info('file-storage', `File downloaded: ${fileInfo.originalName}`, {
        fileId,
        requestedBy,
        size: fileBuffer.length
      });

      this.emit('fileDownloaded', { fileId, requestedBy, filename: fileInfo.originalName });

      return {
        buffer: fileBuffer,
        filename: fileInfo.originalName,
        mimeType: fileInfo.mimeType
      };

    } catch (error) {
      this.logger.error('file-storage', `Failed to download file: ${fileId}`, error as Error);
      throw error;
    }
  }

  async deleteFile(fileId: string, deletedBy: string): Promise<boolean> {
    try {
      const fileInfo = await this.getFile(fileId);
      if (!fileInfo) {
        return false;
      }

      // Delete from disk
      if (fs.existsSync(fileInfo.path)) {
        fs.unlinkSync(fileInfo.path);
      }

      // Delete from CDN if applicable
      if (this.config.cdn.enabled && fileInfo.cdnUrl) {
        await this.deleteFromCDN(fileInfo.cdnUrl);
      }

      // Delete from database
      await this.database.query('DELETE FROM uploaded_files WHERE id = $1', [fileId]);

      // Remove from cache
      await this.cache.delete(`file:${fileId}`);

      this.logger.info('file-storage', `File deleted: ${fileInfo.originalName}`, {
        fileId,
        deletedBy
      });

      this.emit('fileDeleted', { fileId, deletedBy, filename: fileInfo.originalName });
      return true;

    } catch (error) {
      this.logger.error('file-storage', `Failed to delete file: ${fileId}`, error as Error);
      return false;
    }
  }

  async getFile(fileId: string): Promise<UploadedFile | null> {
    try {
      let fileInfo = await this.cache.get<UploadedFile>(`file:${fileId}`);
      if (!fileInfo) {
        const rows = await this.database.query('SELECT * FROM uploaded_files WHERE id = $1', [fileId]);
        if (rows.length === 0) {
          return null;
        }
        fileInfo = this.mapRowToFile(rows[0]);
        await this.cache.set(`file:${fileId}`, fileInfo, { ttl: 3600 });
      }
      return fileInfo;
    } catch (error) {
      this.logger.error('file-storage', `Failed to get file: ${fileId}`, error as Error);
      return null;
    }
  }

  async getFileByHash(hash: string): Promise<UploadedFile | null> {
    try {
      const rows = await this.database.query('SELECT * FROM uploaded_files WHERE hash = $1', [hash]);
      if (rows.length === 0) {
        return null;
      }
      return this.mapRowToFile(rows[0]);
    } catch (error) {
      this.logger.error('file-storage', `Failed to get file by hash: ${hash}`, error as Error);
      return null;
    }
  }

  async getUserFiles(userId: string, limit: number = 50, offset: number = 0): Promise<UploadedFile[]> {
    try {
      const rows = await this.database.query(`
        SELECT * FROM uploaded_files 
        WHERE uploaded_by = $1 
        ORDER BY uploaded_at DESC 
        LIMIT $2 OFFSET $3
      `, [userId, limit, offset]);
      
      return rows.map(row => this.mapRowToFile(row));
    } catch (error) {
      this.logger.error('file-storage', `Failed to get user files: ${userId}`, error as Error);
      return [];
    }
  }

  private validateFile(buffer: Buffer, originalName: string, mimeType: string): FileValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check file size
    if (buffer.length > this.config.maxFileSize) {
      errors.push(`File size ${buffer.length} exceeds maximum allowed size ${this.config.maxFileSize}`);
    }

    // Check MIME type
    if (!this.config.allowedMimeTypes.includes(mimeType)) {
      errors.push(`MIME type ${mimeType} is not allowed`);
    }

    // Check extension
    const extension = path.extname(originalName).toLowerCase().substring(1);
    if (!this.config.allowedExtensions.includes(extension)) {
      errors.push(`File extension .${extension} is not allowed`);
    }

    // Check for suspicious content
    const content = buffer.toString('utf8', 0, Math.min(1024, buffer.length));
    if (content.includes('<script') || content.includes('javascript:')) {
      warnings.push('File contains potentially suspicious content');
    }

    // Check magic bytes
    const detectedMimeType = this.detectMimeType(buffer);
    if (detectedMimeType !== mimeType) {
      warnings.push(`Detected MIME type ${detectedMimeType} does not match declared type ${mimeType}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  private detectMimeType(buffer: Buffer): string {
    // Basic magic byte detection
    const signatures = [
      { bytes: [0xFF, 0xD8, 0xFF], mime: 'image/jpeg' },
      { bytes: [0x89, 0x50, 0x4E, 0x47], mime: 'image/png' },
      { bytes: [0x47, 0x49, 0x46], mime: 'image/gif' },
      { bytes: [0x25, 0x50, 0x44, 0x46], mime: 'application/pdf' },
      { bytes: [0x7B, 0x7B], mime: 'application/json' }
    ];

    for (const signature of signatures) {
      if (buffer.length >= signature.bytes.length) {
        const match = signature.bytes.every((byte, index) => buffer[index] === byte);
        if (match) {
          return signature.mime;
        }
      }
    }

    return 'application/octet-stream';
  }

  private async compressFile(buffer: Buffer): Promise<Buffer> {
    // Placeholder for compression
    // In production, you'd use actual compression algorithms
    return buffer;
  }

  private async decompressFile(buffer: Buffer): Promise<Buffer> {
    // Placeholder for decompression
    return buffer;
  }

  private async encryptFile(buffer: Buffer): Promise<Buffer> {
    if (!this.config.encryption.enabled) {
      return buffer;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.config.encryption.algorithm, this.config.encryption.key);
    cipher.setAAD(Buffer.from('file-encryption'));

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // Combine IV, authTag, and encrypted data
    return Buffer.concat([iv, authTag, encrypted]);
  }

  private async decryptFile(encryptedBuffer: Buffer): Promise<Buffer> {
    if (!this.config.encryption.enabled) {
      return encryptedBuffer;
    }

    const iv = encryptedBuffer.slice(0, 16);
    const authTag = encryptedBuffer.slice(16, 32);
    const encrypted = encryptedBuffer.slice(32);

    const decipher = crypto.createDecipher(this.config.encryption.algorithm, this.config.encryption.key);
    decipher.setAAD(Buffer.from('file-encryption'));
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  private async scanFile(filePath: string): Promise<boolean> {
    if (!this.config.virusScanning.enabled) {
      return true;
    }

    try {
      let command: string;
      
      switch (this.config.virusScanning.scanner) {
        case 'clamav':
          command = `clamscan --no-summary "${filePath}"`;
          break;
        case 'custom':
          if (!this.config.virusScanning.customCommand) {
            throw new Error('Custom virus scanner command not configured');
          }
          command = this.config.virusScanning.customCommand.replace('{file}', filePath);
          break;
        default:
          throw new Error(`Unknown virus scanner: ${this.config.virusScanning.scanner}`);
      }

      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync(command);
      
      // Check if virus found (implementation depends on scanner output)
      const isClean = !stdout.toLowerCase().includes('found') && !stderr.toLowerCase().includes('found');
      
      this.logger.debug('file-storage', `Virus scan completed: ${path.basename(filePath)}`, {
        scanner: this.config.virusScanning.scanner,
        clean: isClean
      });

      return isClean;

    } catch (error) {
      this.logger.error('file-storage', `Virus scan failed: ${path.basename(filePath)}`, error as Error);
      // Fail safe - assume infected if scan fails
      return false;
    }
  }

  private async uploadToCDN(filePath: string, filename: string, mimeType: string): Promise<string> {
    // Placeholder for CDN upload
    // In production, you'd implement actual CDN upload logic
    this.logger.debug('file-storage', `File uploaded to CDN: ${filename}`);
    return `https://cdn.example.com/${filename}`;
  }

  private async downloadFromCDN(cdnUrl: string): Promise<Buffer> {
    // Placeholder for CDN download
    throw new Error('CDN download not implemented');
  }

  private async deleteFromCDN(cdnUrl: string): Promise<void> {
    // Placeholder for CDN deletion
    this.logger.debug('file-storage', `File deleted from CDN: ${cdnUrl}`);
  }

  private startRetentionCleanup(): void {
    const intervalMs = this.config.retention.cleanupInterval * 60 * 60 * 1000; // Convert hours to milliseconds
    
    setInterval(async () => {
      await this.cleanupExpiredFiles();
    }, intervalMs);

    this.logger.info('file-storage', 'File retention cleanup started', {
      interval: `${this.config.retention.cleanupInterval} hours`
    });
  }

  private async cleanupExpiredFiles(): Promise<void> {
    try {
      const rows = await this.database.query(`
        SELECT id, path, cdn_url FROM uploaded_files 
        WHERE expires_at IS NOT NULL AND expires_at <= NOW()
      `);

      let cleanedCount = 0;

      for (const row of rows) {
        try {
          // Delete from disk
          if (row.path && fs.existsSync(row.path)) {
            fs.unlinkSync(row.path);
          }

          // Delete from CDN
          if (row.cdn_url) {
            await this.deleteFromCDN(row.cdn_url);
          }

          // Delete from database
          await this.database.query('DELETE FROM uploaded_files WHERE id = $1', [row.id]);
          
          // Remove from cache
          await this.cache.delete(`file:${row.id}`);

          cleanedCount++;
        } catch (error) {
          this.logger.error('file-storage', `Failed to cleanup expired file: ${row.id}`, error as Error);
        }
      }

      if (cleanedCount > 0) {
        this.logger.info('file-storage', `Cleaned up ${cleanedCount} expired files`);
      }

    } catch (error) {
      this.logger.error('file-storage', 'Failed to cleanup expired files', error as Error);
    }
  }

  private mapRowToFile(row: any): UploadedFile {
    return {
      id: row.id,
      originalName: row.original_name,
      filename: row.filename,
      mimeType: row.mime_type,
      size: row.size,
      path: row.path,
      hash: row.hash,
      uploadedAt: row.uploaded_at,
      uploadedBy: row.uploaded_by,
      metadata: row.metadata,
      encrypted: row.encrypted,
      compressed: row.compressed,
      virusScanned: row.virus_scanned,
      virusClean: row.virus_clean,
      cdnUrl: row.cdn_url,
      expiresAt: row.expires_at
    };
  }

  // Public API methods
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    encryptedFiles: number;
    compressedFiles: number;
    virusScannedFiles: number;
    filesByType: Record<string, number>;
    filesByUser: Array<{ userId: string; count: number; size: number }>;
  }> {
    try {
      const stats = await this.database.query(`
        SELECT 
          COUNT(*) as total_files,
          SUM(size) as total_size,
          COUNT(CASE WHEN encrypted THEN 1 END) as encrypted_files,
          COUNT(CASE WHEN compressed THEN 1 END) as compressed_files,
          COUNT(CASE WHEN virus_scanned THEN 1 END) as virus_scanned_files
        FROM uploaded_files
      `);

      const filesByType = await this.database.query(`
        SELECT mime_type, COUNT(*) as count 
        FROM uploaded_files 
        GROUP BY mime_type
      `);

      const filesByUser = await this.database.query(`
        SELECT uploaded_by, COUNT(*) as count, SUM(size) as size 
        FROM uploaded_files 
        GROUP BY uploaded_by 
        ORDER BY count DESC 
        LIMIT 10
      `);

      return {
        totalFiles: parseInt(stats[0].total_files),
        totalSize: parseInt(stats[0].total_size) || 0,
        encryptedFiles: parseInt(stats[0].encrypted_files),
        compressedFiles: parseInt(stats[0].compressed_files),
        virusScannedFiles: parseInt(stats[0].virus_scanned_files),
        filesByType: filesByType.reduce((acc, row) => {
          acc[row.mime_type] = parseInt(row.count);
          return acc;
        }, {}),
        filesByUser: filesByUser.map(row => ({
          userId: row.uploaded_by,
          count: parseInt(row.count),
          size: parseInt(row.size) || 0
        }))
      };

    } catch (error) {
      this.logger.error('file-storage', 'Failed to get storage stats', error as Error);
      throw error;
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    uploadPathExists: boolean;
    uploadPathWritable: boolean;
    databaseConnected: boolean;
    virusScannerWorking: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    // Check upload path
    const uploadPathExists = fs.existsSync(this.config.uploadPath);
    if (!uploadPathExists) {
      issues.push('Upload path does not exist');
    }

    // Check write permissions
    let uploadPathWritable = false;
    if (uploadPathExists) {
      try {
        const testFile = path.join(this.config.uploadPath, '.health-check');
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
        uploadPathWritable = true;
      } catch (error) {
        issues.push('Upload path is not writable');
      }
    }

    // Check database connection
    let databaseConnected = false;
    try {
      await this.database.query('SELECT 1');
      databaseConnected = true;
    } catch (error) {
      issues.push('Database connection failed');
    }

    // Check virus scanner
    let virusScannerWorking = true;
    if (this.config.virusScanning.enabled) {
      try {
        // Try to run virus scanner version command
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        if (this.config.virusScanning.scanner === 'clamav') {
          await execAsync('clamscan --version');
        }
      } catch (error) {
        issues.push('Virus scanner not working');
        virusScannerWorking = false;
      }
    }

    return {
      healthy: issues.length === 0,
      uploadPathExists,
      uploadPathWritable,
      databaseConnected,
      virusScannerWorking,
      issues
    };
  }
}

export default UltraFileStorage;
