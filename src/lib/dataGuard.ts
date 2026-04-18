/**
 * Frontend Data Guard
 * Prevents crashes on null data by providing fallbacks
 */

export interface DataGuardOptions {
  fallback?: any;
  logError?: boolean;
  context?: string;
}

/**
 * Guard against null/undefined values
 */
export function guard<T>(
  data: T | null | undefined,
  options: DataGuardOptions = {}
): T {
  const { fallback = null, logError = true, context = 'dataGuard' } = options;

  if (data === null || data === undefined) {
    if (logError) {
      console.warn(`[${context}] Null/undefined data detected, using fallback`);
    }
    return fallback;
  }

  return data;
}

/**
 * Guard array against null/undefined
 */
export function guardArray<T>(
  data: T[] | null | undefined,
  options: DataGuardOptions = {}
): T[] {
  const { fallback = [], logError = true, context = 'guardArray' } = options;

  if (!Array.isArray(data)) {
    if (logError) {
      console.warn(`[${context}] Expected array but got ${typeof data}, using fallback`);
    }
    return fallback;
  }

  return data;
}

/**
 * Guard object against null/undefined
 */
export function guardObject<T extends object>(
  data: T | null | undefined,
  options: DataGuardOptions = {}
): T {
  const { fallback = {} as T, logError = true, context = 'guardObject' } = options;

  if (data === null || data === undefined || typeof data !== 'object') {
    if (logError) {
      console.warn(`[${context}] Expected object but got ${typeof data}, using fallback`);
    }
    return fallback;
  }

  return data;
}

/**
 * Guard string against null/undefined
 */
export function guardString(
  data: string | null | undefined,
  options: DataGuardOptions = {}
): string {
  const { fallback = '', logError = true, context = 'guardString' } = options;

  if (data === null || data === undefined) {
    if (logError) {
      console.warn(`[${context}] Null/undefined string detected, using fallback`);
    }
    return fallback;
  }

  return String(data);
}

/**
 * Guard number against null/undefined/NaN
 */
export function guardNumber(
  data: number | null | undefined,
  options: DataGuardOptions = {}
): number {
  const { fallback = 0, logError = true, context = 'guardNumber' } = options;

  if (data === null || data === undefined || isNaN(data)) {
    if (logError) {
      console.warn(`[${context}] Invalid number detected, using fallback`);
    }
    return fallback;
  }

  return data;
}

/**
 * Guard boolean against null/undefined
 */
export function guardBoolean(
  data: boolean | null | undefined,
  options: DataGuardOptions = {}
): boolean {
  const { fallback = false, logError = true, context = 'guardBoolean' } = options;

  if (data === null || data === undefined) {
    if (logError) {
      console.warn(`[${context}] Null/undefined boolean detected, using fallback`);
    }
    return fallback;
  }

  return data;
}

/**
 * Deep guard nested object
 */
export function guardDeep<T>(
  data: T,
  path: string,
  options: DataGuardOptions = {}
): any {
  const { fallback = null, logError = true, context = 'guardDeep' } = options;

  try {
    const keys = path.split('.');
    let result: any = data;

    for (const key of keys) {
      if (result === null || result === undefined) {
        if (logError) {
          console.warn(`[${context}] Path ${path} is null/undefined at ${key}, using fallback`);
        }
        return fallback;
      }
      result = result[key];
    }

    if (result === null || result === undefined) {
      if (logError) {
        console.warn(`[${context}] Path ${path} resolved to null/undefined, using fallback`);
      }
      return fallback;
    }

    return result;
  } catch (error) {
    if (logError) {
      console.error(`[${context}] Error accessing path ${path}:`, error);
    }
    return fallback;
  }
}

/**
 * Safe map function that handles null/undefined
 */
export function safeMap<T, U>(
  array: T[] | null | undefined,
  mapper: (item: T, index: number) => U,
  options: DataGuardOptions = {}
): U[] {
  const guarded = guardArray(array, { ...options, logError: false });
  return guarded.map(mapper);
}

/**
 * Safe filter function that handles null/undefined
 */
export function safeFilter<T>(
  array: T[] | null | undefined,
  predicate: (item: T, index: number) => boolean,
  options: DataGuardOptions = {}
): T[] {
  const guarded = guardArray(array, { ...options, logError: false });
  return guarded.filter(predicate);
}

/**
 * Safe reduce function that handles null/undefined
 */
export function safeReduce<T, U>(
  array: T[] | null | undefined,
  reducer: (acc: U, item: T, index: number) => U,
  initialValue: U,
  options: DataGuardOptions = {}
): U {
  const guarded = guardArray(array, { ...options, logError: false });
  return guarded.reduce(reducer, initialValue);
}
