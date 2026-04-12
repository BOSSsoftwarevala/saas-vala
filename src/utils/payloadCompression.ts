// STEP 86: PAYLOAD COMPRESSION - Compress large messages/media before send
export interface CompressionConfig {
  minSize: number; // Minimum size to compress (bytes)
  maxSize: number; // Maximum size to compress (bytes)
  compressionLevel: number; // 1-9
  algorithm: 'gzip' | 'deflate' | 'br'; // brotli, gzip, deflate
}

export interface CompressedPayload {
  data: string | ArrayBuffer;
  compressed: boolean;
  originalSize: number;
  compressedSize: number;
  algorithm: string;
  compressionRatio: number;
}

export class PayloadCompressor {
  private static instance: PayloadCompressor;
  private config: CompressionConfig;
  private supportedAlgorithms: string[] = [];

  static getInstance(config?: Partial<CompressionConfig>): PayloadCompressor {
    if (!PayloadCompressor.instance) {
      PayloadCompressor.instance = new PayloadCompressor(config);
    }
    return PayloadCompressor.instance;
  }

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = {
      minSize: 1024, // 1KB minimum
      maxSize: 10 * 1024 * 1024, // 10MB maximum
      compressionLevel: 6,
      algorithm: 'gzip',
      ...config
    };

    this.detectSupportedAlgorithms();
  }

  private detectSupportedAlgorithms() {
    // Check for CompressionStream support
    if ('CompressionStream' in window) {
      this.supportedAlgorithms.push('gzip', 'deflate');
      // Check for brotli support
      try {
        new CompressionStream('br');
        this.supportedAlgorithms.push('br');
      } catch {
        // Brotli not supported
      }
    }
  }

  // Compress payload if beneficial
  async compress(payload: string | ArrayBuffer): Promise<CompressedPayload> {
    const originalSize = typeof payload === 'string' 
      ? new Blob([payload]).size 
      : payload.byteLength;

    // Don't compress if too small or too large
    if (originalSize < this.config.minSize || originalSize > this.config.maxSize) {
      return {
        data: payload,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        algorithm: 'none',
        compressionRatio: 1
      };
    }

    // Don't compress if algorithm not supported
    if (!this.supportedAlgorithms.includes(this.config.algorithm)) {
      console.warn(`Compression algorithm ${this.config.algorithm} not supported`);
      return {
        data: payload,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        algorithm: 'none',
        compressionRatio: 1
      };
    }

    try {
      const compressedData = await this.performCompression(payload, this.config.algorithm);
      const compressedSize = typeof compressedData === 'string' 
        ? new Blob([compressedData]).size 
        : compressedData.byteLength;

      const compressionRatio = originalSize / compressedSize;

      // Only use compression if it actually reduces size (at least 10% reduction)
      if (compressionRatio > 1.1) {
        return {
          data: compressedData,
          compressed: true,
          originalSize,
          compressedSize,
          algorithm: this.config.algorithm,
          compressionRatio
        };
      } else {
        // Compression didn't help, use original
        return {
          data: payload,
          compressed: false,
          originalSize,
          compressedSize: originalSize,
          algorithm: 'none',
          compressionRatio: 1
        };
      }
    } catch (error) {
      console.error('Compression failed:', error);
      // Fallback to original payload
      return {
        data: payload,
        compressed: false,
        originalSize,
        compressedSize: originalSize,
        algorithm: 'none',
        compressionRatio: 1
      };
    }
  }

  // Perform actual compression
  private async performCompression(
    payload: string | ArrayBuffer, 
    algorithm: string
  ): Promise<string | ArrayBuffer> {
    if (!('CompressionStream' in window)) {
      throw new Error('CompressionStream not supported');
    }

    const stream = new CompressionStream(algorithm as CompressionFormat);
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    // Write payload to stream
    if (typeof payload === 'string') {
      const encoder = new TextEncoder();
      writer.write(encoder.encode(payload));
    } else {
      writer.write(new Uint8Array(payload));
    }
    writer.close();

    // Read compressed data
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined.buffer;
  }

  // Decompress payload
  async decompress(compressedPayload: CompressedPayload): Promise<string | ArrayBuffer> {
    if (!compressedPayload.compressed) {
      return compressedPayload.data;
    }

    try {
      return await this.performDecompression(
        compressedPayload.data, 
        compressedPayload.algorithm
      );
    } catch (error) {
      console.error('Decompression failed:', error);
      throw new Error('Failed to decompress payload');
    }
  }

  // Perform actual decompression
  private async performDecompression(
    compressedData: string | ArrayBuffer,
    algorithm: string
  ): Promise<string | ArrayBuffer> {
    if (!('DecompressionStream' in window)) {
      throw new Error('DecompressionStream not supported');
    }

    const stream = new DecompressionStream(algorithm as CompressionFormat);
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();

    // Write compressed data to stream
    const data = typeof compressedData === 'string' 
      ? new TextEncoder().encode(compressedData)
      : new Uint8Array(compressedData);
    
    writer.write(data);
    writer.close();

    // Read decompressed data
    const chunks: Uint8Array[] = [];
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      if (value) {
        chunks.push(value);
      }
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.length;
    }

    return combined.buffer;
  }

  // Compress for API request
  async compressForRequest(data: any): Promise<{
    data: string | ArrayBuffer;
    headers: Record<string, string>;
  }> {
    const jsonString = JSON.stringify(data);
    const compressed = await this.compress(jsonString);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (compressed.compressed) {
      headers['Content-Encoding'] = compressed.algorithm;
      headers['X-Original-Size'] = compressed.originalSize.toString();
      headers['X-Compressed-Size'] = compressed.compressedSize.toString();
      headers['X-Compression-Ratio'] = compressed.compressionRatio.toFixed(2);
    }

    return {
      data: compressed.data,
      headers
    };
  }

  // Decompress API response
  async decompressResponse(
    data: string | ArrayBuffer,
    headers: Record<string, string>
  ): Promise<any> {
    const contentEncoding = headers['content-encoding'];
    
    if (!contentEncoding || contentEncoding === 'identity') {
      // Not compressed
      return typeof data === 'string' ? JSON.parse(data) : JSON.parse(new TextDecoder().decode(data));
    }

    const compressedPayload: CompressedPayload = {
      data,
      compressed: true,
      originalSize: parseInt(headers['x-original-size'] || '0'),
      compressedSize: parseInt(headers['x-compressed-size'] || '0'),
      algorithm: contentEncoding,
      compressionRatio: parseFloat(headers['x-compression-ratio'] || '1')
    };

    const decompressed = await this.decompress(compressedPayload);
    const jsonString = typeof decompressed === 'string' 
      ? decompressed 
      : new TextDecoder().decode(decompressed);
    
    return JSON.parse(jsonString);
  }

  // Get compression statistics
  getCompressionStats(): {
    supportedAlgorithms: string[];
    currentConfig: CompressionConfig;
    estimatedSavings: {
      text: number; // percentage
      binary: number; // percentage
    };
  } {
    return {
      supportedAlgorithms: this.supportedAlgorithms,
      currentConfig: this.config,
      estimatedSavings: {
        text: 0.7, // 70% savings for text
        binary: 0.3 // 30% savings for binary
      }
    };
  }

  // Update configuration
  updateConfig(newConfig: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  // Test compression performance
  async testCompression(payload: string): Promise<{
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
    compressionTime: number;
    decompressionTime: number;
  }> {
    const startTime = performance.now();
    const compressed = await this.compress(payload);
    const compressionTime = performance.now() - startTime;

    const decompressStartTime = performance.now();
    await this.decompress(compressed);
    const decompressionTime = performance.now() - decompressStartTime;

    return {
      originalSize: compressed.originalSize,
      compressedSize: compressed.compressedSize,
      compressionRatio: compressed.compressionRatio,
      compressionTime,
      decompressionTime
    };
  }

  // Check if compression is beneficial for content type
  shouldCompressContentType(contentType: string): boolean {
    const compressibleTypes = [
      'text/',
      'application/json',
      'application/javascript',
      'application/xml',
      'image/svg+xml'
    ];

    return compressibleTypes.some(type => contentType.toLowerCase().includes(type));
  }

  // Get optimal compression level based on content size
  getOptimalCompressionLevel(size: number): number {
    if (size < 10 * 1024) return 3; // Small files: fast compression
    if (size < 100 * 1024) return 6; // Medium files: balanced
    return 9; // Large files: maximum compression
  }
}

export const payloadCompressor = PayloadCompressor.getInstance();
