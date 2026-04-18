/**
 * Micro Validations
 * Collection of micro-level validation utilities for type safety, data integrity,
 * and edge case handling throughout the application.
 */

import React from 'react';
import { selfHealingEngine } from './selfHealingEngine';
import { localApi } from './localApi';

// Field Level Validation
export interface FieldValidationConfig {
  type?: 'string' | 'number' | 'boolean' | 'email' | 'url' | 'uuid';
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  required?: boolean;
  trim?: boolean;
  sanitize?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: any;
}

export function validateField(value: any, config: FieldValidationConfig = {}): ValidationResult {
  const result: ValidationResult = { valid: true };

  // Check required
  if (config.required && (value === null || value === undefined || value === '')) {
    return { valid: false, error: 'Field is required' };
  }

  // Skip validation if not required and value is empty
  if (!config.required && (value === null || value === undefined || value === '')) {
    return { valid: true };
  }

  // Trim if configured
  let sanitizedValue = value;
  if (config.trim && typeof value === 'string') {
    sanitizedValue = value.trim();
  }

  // Type check
  if (config.type) {
    switch (config.type) {
      case 'string':
        if (typeof sanitizedValue !== 'string') {
          return { valid: false, error: 'Field must be a string' };
        }
        break;
      case 'number':
        if (typeof sanitizedValue !== 'number' || isNaN(sanitizedValue)) {
          return { valid: false, error: 'Field must be a number' };
        }
        break;
      case 'boolean':
        if (typeof sanitizedValue !== 'boolean') {
          return { valid: false, error: 'Field must be a boolean' };
        }
        break;
      case 'email':
        if (typeof sanitizedValue !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sanitizedValue)) {
          return { valid: false, error: 'Field must be a valid email' };
        }
        break;
      case 'url':
        if (typeof sanitizedValue !== 'string' || !/^https?:\/\/.+/.test(sanitizedValue)) {
          return { valid: false, error: 'Field must be a valid URL' };
        }
        break;
      case 'uuid':
        if (typeof sanitizedValue !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sanitizedValue)) {
          return { valid: false, error: 'Field must be a valid UUID' };
        }
        break;
    }
  }

  // Length check for strings
  if (typeof sanitizedValue === 'string') {
    if (config.minLength !== undefined && sanitizedValue.length < config.minLength) {
      return { valid: false, error: `Field must be at least ${config.minLength} characters` };
    }
    if (config.maxLength !== undefined && sanitizedValue.length > config.maxLength) {
      return { valid: false, error: `Field must be at most ${config.maxLength} characters` };
    }
  }

  // Range check for numbers
  if (typeof sanitizedValue === 'number') {
    if (config.min !== undefined && sanitizedValue < config.min) {
      return { valid: false, error: `Field must be at least ${config.min}` };
    }
    if (config.max !== undefined && sanitizedValue > config.max) {
      return { valid: false, error: `Field must be at most ${config.max}` };
    }
  }

  // Sanitize if configured
  if (config.sanitize && typeof sanitizedValue === 'string') {
    sanitizedValue = sanitizeString(sanitizedValue);
  }

  result.sanitized = sanitizedValue;
  return result;
}

export function sanitizeString(str: string): string {
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

// ID Consistency
export function validateUUID(id: any): ValidationResult {
  if (typeof id !== 'string') {
    return { valid: false, error: 'ID must be a string' };
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return { valid: false, error: 'ID must be a valid UUID' };
  }

  return { valid: true };
}

// Time Consistency
export function validateTimestamp(timestamp: any): ValidationResult {
  if (timestamp === null || timestamp === undefined) {
    return { valid: false, error: 'Timestamp cannot be null or undefined' };
  }

  const date = new Date(timestamp);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid timestamp format' };
  }

  return { valid: true };
}

export function ensureTimestamp(record: any): any {
  const now = new Date().toISOString();
  if (!record.created_at) {
    record.created_at = now;
  }
  if (!record.updated_at) {
    record.updated_at = now;
  }
  return record;
}

// Array Safety
export function safeMap<T, U>(array: T[] | null | undefined, mapFn: (item: T, index: number) => U): U[] {
  if (!array || !Array.isArray(array)) {
    return [];
  }
  return array.map(mapFn);
}

export function safeArray(array: any): any[] {
  if (!array || !Array.isArray(array)) {
    return [];
  }
  return array;
}

// Number Safety
export function safeNumber(value: any, fallback: number = 0): number {
  if (typeof value === 'number' && !isNaN(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (!isNaN(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

// String Safety
export function safeString(value: any, fallback: string = ''): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  return String(value);
}

// Click Lock
export class ClickLock {
  private locks: Map<string, number> = new Map();
  private lockTimeout: number = 5000; // 5 seconds

  acquireLock(key: string): boolean {
    const existingLock = this.locks.get(key);
    if (existingLock && Date.now() - existingLock < this.lockTimeout) {
      return false; // Lock still active
    }

    this.locks.set(key, Date.now());
    return true;
  }

  releaseLock(key: string): void {
    this.locks.delete(key);
  }

  isLocked(key: string): boolean {
    const existingLock = this.locks.get(key);
    if (!existingLock) return false;

    const isExpired = Date.now() - existingLock > this.lockTimeout;
    if (isExpired) {
      this.locks.delete(key);
      return false;
    }

    return true;
  }

  setLockTimeout(timeout: number): void {
    this.lockTimeout = timeout;
  }
}

export const clickLock = new ClickLock();

// Loading Micro
export interface LoadingState {
  isLoading: boolean;
  error: Error | null;
}

export async function withLoading<T>(
  asyncFn: () => Promise<T>,
  setLoading: (loading: boolean) => void,
  setError: (error: Error | null) => void
): Promise<T> {
  setLoading(true);
  setError(null);

  try {
    const result = await asyncFn();
    return result;
  } catch (error) {
    setError(error instanceof Error ? error : new Error('Unknown error'));
    throw error;
  } finally {
    setLoading(false);
  }
}

// Error Message Micro
export function getUserFriendlyError(error: any): string {
  if (!error) {
    return 'An unknown error occurred';
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    // Return user-friendly message, not the raw error
    const message = error.message.toLowerCase();

    if (message.includes('network') || message.includes('fetch')) {
      return 'Network error. Please check your connection.';
    }
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (message.includes('unauthorized') || message.includes('auth')) {
      return 'You need to log in to perform this action.';
    }
    if (message.includes('not found')) {
      return 'The requested resource was not found.';
    }

    return 'An error occurred. Please try again.';
  }

  return 'An error occurred. Please try again.';
}

// Null Shield
export function nullShield<T>(data: T | null | undefined, fallback: T): T {
  if (data === null || data === undefined) {
    return fallback;
  }
  return data;
}

// Storage Consistency
export class StorageConsistency {
  private syncInterval: number | null = null;

  syncWithLocalStorage(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Failed to sync to localStorage:', error);
    }
  }

  getFromLocalStorage<T>(key: string, fallback: T): T {
    try {
      const item = localStorage.getItem(key);
      if (item) {
        return JSON.parse(item);
      }
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
    }
    return fallback;
  }

  clearStaleCache(maxAge: number = 24 * 60 * 60 * 1000): void {
    try {
      const now = Date.now();
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const item = localStorage.getItem(key);
          if (item) {
            try {
              const parsed = JSON.parse(item);
              if (parsed.timestamp && now - parsed.timestamp > maxAge) {
                localStorage.removeItem(key);
              }
            } catch {
              // Invalid JSON, remove it
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to clear stale cache:', error);
    }
  }

  startAutoSync(intervalMs: number = 60 * 1000): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    this.syncInterval = window.setInterval(() => {
      this.clearStaleCache();
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const storageConsistency = new StorageConsistency();

// Memory Cleanup
export function cleanupEffect(cleanupFn: () => void): () => void {
  return cleanupFn;
}

export function useEffectOnce(effect: () => () => void): void {
  const hasRun = React.useRef(false);

  React.useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      return effect();
    }
  }, []);
}

// Event Cleanup
export function addEventListenerSafe(
  target: EventTarget,
  event: string,
  handler: EventListener
): () => void {
  target.addEventListener(event, handler);
  return () => target.removeEventListener(event, handler);
}

// Debounce for Search
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = window.setTimeout(later, wait);
  };
}

// Filter Edge
export function handleEmptyFilter<T>(items: T[], fallbackMessage: string = 'No results found'): {
  items: T[];
  showFallback: boolean;
  message: string;
} {
  const isEmpty = !items || items.length === 0;
  return {
    items: items || [],
    showFallback: isEmpty,
    message: isEmpty ? fallbackMessage : '',
  };
}

// Button Edge
export function getButtonState(
  isLoading: boolean,
  isDisabled: boolean,
  isValid: boolean
): {
  disabled: boolean;
  loading: boolean;
} {
  return {
    disabled: isLoading || isDisabled || !isValid,
    loading: isLoading,
  };
}

// Form Edge
export function validateForm<T extends Record<string, any>>(
  data: T,
  validations: Record<keyof T, FieldValidationConfig>
): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  let valid = true;

  for (const [field, config] of Object.entries(validations)) {
    const result = validateField(data[field as keyof T], config);
    if (!result.valid) {
      errors[field] = result.error || 'Invalid value';
      valid = false;
    }
  }

  return { valid, errors };
}

// Log Edge
export class ActionLogger {
  private logs: Array<{ action: string; timestamp: string; context?: any }> = [];

  log(action: string, context?: any): void {
    const logEntry = {
      action,
      timestamp: new Date().toISOString(),
      context,
    };

    this.logs.push(logEntry);

    // Keep only last 1000 logs
    if (this.logs.length > 1000) {
      this.logs.shift();
    }

    // Log to console (without sensitive data)
    console.log(`[Action] ${action}`, { timestamp: logEntry.timestamp });
  }

  getLogs(): Array<{ action: string; timestamp: string; context?: any }> {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  getRecentLogs(count: number = 10): Array<{ action: string; timestamp: string; context?: any }> {
    return this.logs.slice(-count);
  }
}

export const actionLogger = new ActionLogger();

// Security Edge - No console secrets
export function safeConsoleLog(message: string, data?: any): void {
  // Sanitize data before logging
  const sanitized = data ? sanitizeForLogging(data) : undefined;
  console.log(message, sanitized);
}

function sanitizeForLogging(data: any): any {
  if (typeof data === 'string') {
    // Check for sensitive patterns
    if (/password|token|secret|key|api/i.test(data)) {
      return '[REDACTED]';
    }
    return data;
  }

  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const key in data) {
      if (/password|token|secret|key|api/i.test(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeForLogging(data[key]);
      }
    }
    return sanitized;
  }

  return data;
}

// API Edge Case - Empty response handled, partial response handled
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  partial: boolean;
}

export function handleApiResponse<T>(response: any, fallback: T): ApiResponse<T> {
  if (!response) {
    return { data: fallback, error: 'No response', partial: false };
  }

  if (response.error) {
    return { data: fallback, error: response.error, partial: false };
  }

  if (!response.data) {
    return { data: fallback, error: null, partial: false };
  }

  // Check for partial data
  const isPartial = response.data === null || response.data === undefined || 
    (typeof response.data === 'object' && Object.keys(response.data).length === 0);

  return { data: response.data, error: null, partial: isPartial };
}

// DB Edge Case - No duplicate row, no orphan relation
export async function checkDuplicateRecord(tableName: string, field: string, value: any): Promise<boolean> {
  try {
    const { data } = await localApi.select(tableName).eq(field, value).execute();
    const records = (data as any)?.data || [];
    return records.length > 0;
  } catch (error) {
    console.error('Error checking duplicate:', error);
    return false;
  }
}

export async function checkOrphanRelation(tableName: string, relationField: string, relationTable: string): Promise<boolean> {
  try {
    const { data } = await localApi.select(tableName).execute();
    const records = (data as any)?.data || [];

    for (const record of records) {
      const relationId = record[relationField];
      if (relationId) {
        const { data: relationData } = await localApi.select(relationTable).eq('id', relationId).execute();
        const relationRecords = (relationData as any)?.data || [];
        if (relationRecords.length === 0) {
          return true; // Orphan found
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking orphan relations:', error);
    return false;
  }
}

// Network Edge - Slow network fallback, retry safe
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }

  throw lastError;
}

export async function withTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
    ),
  ]);
}

// Role Edge - Role change → UI refresh, no ghost access
export class RoleManager {
  private currentRole: string | null = null;
  private listeners: Set<(role: string | null) => void> = new Set();

  setRole(role: string): void {
    if (this.currentRole !== role) {
      this.currentRole = role;
      this.notifyListeners();
    }
  }

  getRole(): string | null {
    return this.currentRole;
  }

  subscribe(listener: (role: string | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener(this.currentRole));
  }

  hasPermission(requiredRole: string): boolean {
    if (!this.currentRole) return false;
    
    const roleHierarchy = ['admin', 'boss', 'reseller', 'user'];
    const currentIndex = roleHierarchy.indexOf(this.currentRole);
    const requiredIndex = roleHierarchy.indexOf(requiredRole);

    return currentIndex <= requiredIndex;
  }
}

export const roleManager = new RoleManager();

// Route Edge - Invalid param → redirect, missing param → block
export function validateRouteParams(params: Record<string, any>, requiredParams: string[]): {
  valid: boolean;
  missing: string[];
  invalid: string[];
} {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const param of requiredParams) {
    if (!(param in params) || params[param] === null || params[param] === undefined) {
      missing.push(param);
    }
  }

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') {
      invalid.push(key);
    }
  }

  return {
    valid: missing.length === 0 && invalid.length === 0,
    missing,
    invalid,
  };
}

// Image Edge - Broken image → fallback
export function handleImageError(event: React.SyntheticEvent<HTMLImageElement>, fallbackSrc: string): void {
  event.currentTarget.src = fallbackSrc;
  event.currentTarget.onerror = null; // Prevent infinite loop
}

export function getImageWithFallback(src: string, fallback: string = '/placeholder.png'): string {
  return src || fallback;
}

// File Edge - Upload size check, format check
export interface FileValidationConfig {
  maxSizeMB?: number;
  allowedTypes?: string[];
  allowedExtensions?: string[];
}

export function validateFile(file: File, config: FileValidationConfig = {}): ValidationResult {
  // Size check
  if (config.maxSizeMB) {
    const maxSizeBytes = config.maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return { valid: false, error: `File size exceeds ${config.maxSizeMB}MB limit` };
    }
  }

  // MIME type check
  if (config.allowedTypes && config.allowedTypes.length > 0) {
    if (!config.allowedTypes.includes(file.type)) {
      return { valid: false, error: `File type ${file.type} is not allowed` };
    }
  }

  // Extension check
  if (config.allowedExtensions && config.allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!config.allowedExtensions.includes(extension)) {
      return { valid: false, error: `File extension .${extension} is not allowed` };
    }
  }

  return { valid: true };
}

// Build Edge - No warning, no unused chunk (placeholder for build-time checks)
export function validateBuildConfig(config: any): ValidationResult {
  if (!config) {
    return { valid: false, error: 'Build config is required' };
  }

  if (!config.entry || !config.output) {
    return { valid: false, error: 'Build config must have entry and output' };
  }

  return { valid: true };
}

// Deploy Edge - Latest build running, no old cache (placeholder for deployment checks)
export function checkDeploymentStatus(): {
  isLatest: boolean;
  cacheCleared: boolean;
  version: string;
} {
  // In a real implementation, this would check deployment status
  return {
    isLatest: true,
    cacheCleared: true,
    version: '1.0.0',
  };
}

// Final Assert Micro Loop
export async function executeWithValidation<T>(
  action: string,
  validate: () => ValidationResult,
  execute: () => Promise<T>,
  updateDB?: (result: T) => Promise<void>,
  updateUI?: (result: T) => void
): Promise<T> {
  // Validate
  const validation = validate();
  if (!validation.valid) {
    throw new Error(validation.error || 'Validation failed');
  }

  // Execute
  const result = await execute();

  // Log
  actionLogger.log(action, { success: true });

  // Update DB
  if (updateDB) {
    await updateDB(result);
  }

  // Update UI
  if (updateUI) {
    updateUI(result);
  }

  return result;
}
