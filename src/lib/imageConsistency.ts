/**
 * File / Image Consistency Utility
 * Adds image exists check and fallback image
 */

const FALLBACK_IMAGE = '/api/placeholder/400/400';
const FALLBACK_AVATAR = '/api/placeholder/100/100';

/**
 * Check if an image URL is valid
 */
export async function imageExists(url: string): Promise<boolean> {
  if (!url || url.trim() === '') {
    return false;
  }

  // Skip base64 images
  if (url.startsWith('data:image')) {
    return true;
  }

  // Skip placeholder images
  if (url.includes('/api/placeholder')) {
    return true;
  }

  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok && response.headers.get('content-type')?.startsWith('image/');
  } catch {
    return false;
  }
}

/**
 * Get image URL with fallback
 */
export function getImageUrl(url: string | null | undefined, fallback: string = FALLBACK_IMAGE): string {
  if (!url || url.trim() === '') {
    return fallback;
  }
  return url;
}

/**
 * Get avatar URL with fallback
 */
export function getAvatarUrl(url: string | null | undefined): string {
  return getImageUrl(url, FALLBACK_AVATAR);
}

/**
 * Preload image to check if it exists
 */
export function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
  });
}

/**
 * Load image with error handling and fallback
 */
export function loadImageWithFallback(
  url: string,
  fallback: string = FALLBACK_IMAGE,
  onLoad?: () => void,
  onError?: () => void
): void {
  const img = new Image();
  
  img.onload = () => {
    onLoad?.();
  };
  
  img.onerror = () => {
    // Try fallback on error
    const fallbackImg = new Image();
    fallbackImg.onload = () => onLoad?.();
    fallbackImg.onerror = () => onError?.();
    fallbackImg.src = fallback;
  };
  
  img.src = url;
}

/**
 * Validate image file type
 */
export function isValidImageType(file: File): boolean {
  const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  return validTypes.includes(file.type);
}

/**
 * Validate image file size
 */
export function isValidImageSize(file: File, maxSizeMB: number = 5): boolean {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  return file.size <= maxSizeBytes;
}

/**
 * Validate image file
 */
export function validateImageFile(file: File, maxSizeMB: number = 5): { valid: boolean; error?: string } {
  if (!isValidImageType(file)) {
    return { valid: false, error: 'Invalid image type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.' };
  }
  
  if (!isValidImageSize(file, maxSizeMB)) {
    return { valid: false, error: `Image size exceeds ${maxSizeMB}MB limit.` };
  }
  
  return { valid: true };
}

/**
 * Get image dimensions
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Resize image to fit within max dimensions
 */
export function resizeImage(
  file: File,
  maxWidth: number,
  maxHeight: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Calculate new dimensions
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to resize image'));
        }
      }, file.type);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Convert file to base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Get file extension
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Check if file is an image
 */
export function isImageFile(filename: string): boolean {
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico'];
  const ext = getFileExtension(filename);
  return imageExtensions.includes(ext);
}
