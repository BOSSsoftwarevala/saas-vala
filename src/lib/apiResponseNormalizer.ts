/**
 * API Response Normalizer
 * Ensures same structure everywhere: {success, data, error}
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  error: string | null;
  timestamp?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Create a successful API response
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Create an error API response
 */
export function errorResponse(error: string | Error | ApiError): ApiResponse<null> {
  let errorMessage = 'An unknown error occurred';
  let errorCode: string | undefined;

  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error instanceof Error) {
    errorMessage = error.message;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = error.message;
    errorCode = error.code;
  }

  return {
    success: false,
    data: null,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Normalize any response to ApiResponse format
 */
export function normalizeResponse<T>(response: any): ApiResponse<T> {
  // If already normalized, return as-is
  if (
    response &&
    typeof response === 'object' &&
    'success' in response &&
    'data' in response &&
    'error' in response
  ) {
    return response as ApiResponse<T>;
  }

  // If response has data field, treat as success
  if (response && typeof response === 'object' && 'data' in response) {
    return successResponse(response.data);
  }

  // If response has error field, treat as error
  if (response && typeof response === 'object' && 'error' in response) {
    return errorResponse(response.error);
  }

  // If response is an array or object without explicit success/error, treat as success
  if (response !== null && response !== undefined) {
    return successResponse(response);
  }

  // Fallback to error
  return errorResponse('Invalid response format');
}

/**
 * Wrap an async function to always return normalized response
 */
export function withNormalizedResponse<T>(
  fn: () => Promise<T>
): Promise<ApiResponse<T>> {
  return fn()
    .then((data) => successResponse(data))
    .catch((error) => errorResponse(error));
}

/**
 * Extract data from normalized response with type safety
 */
export function extractData<T>(response: ApiResponse<T>): T | null {
  return response.success ? response.data : null;
}

/**
 * Extract error from normalized response
 */
export function extractError(response: ApiResponse<null>): string | null {
  return response.success ? null : response.error;
}
