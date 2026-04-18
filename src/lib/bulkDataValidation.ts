/**
 * Bulk Data Validation Pipeline
 * Validates hierarchy chain on import, rejects invalid rows
 */

import { supabase } from '@/lib/supabase';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  row: number;
  field: string;
  message: string;
  severity: 'error' | 'critical';
}

export interface ValidationWarning {
  row: number;
  field: string;
  message: string;
}

export interface CategoryHierarchy {
  category_id?: string;
  sub_category_id?: string;
  micro_category_id?: string;
  nano_category_id?: string;
}

/**
 * Validate category hierarchy chain
 */
export async function validateCategoryHierarchy(
  hierarchy: CategoryHierarchy
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  // If no category is specified, it's valid
  if (!hierarchy.category_id) {
    return { valid: true, errors: [] };
  }

  // Validate category exists
  const { data: category, error: categoryError } = await supabase
    .from('categories')
    .select('id')
    .eq('id', hierarchy.category_id)
    .maybeSingle();

  if (categoryError || !category) {
    errors.push('Category does not exist');
    return { valid: false, errors };
  }

  // If sub_category is specified, validate it exists and belongs to category
  if (hierarchy.sub_category_id) {
    const { data: subCategory, error: subError } = await supabase
      .from('sub_categories')
      .select('id, parent_id')
      .eq('id', hierarchy.sub_category_id)
      .maybeSingle();

    if (subError || !subCategory) {
      errors.push('Sub-category does not exist');
      return { valid: false, errors };
    }

    if (subCategory.parent_id !== hierarchy.category_id) {
      errors.push('Sub-category does not belong to specified category');
      return { valid: false, errors };
    }
  }

  // If micro_category is specified, validate it exists and belongs to sub_category
  if (hierarchy.micro_category_id) {
    if (!hierarchy.sub_category_id) {
      errors.push('Micro-category requires sub-category');
      return { valid: false, errors };
    }

    const { data: microCategory, error: microError } = await supabase
      .from('micro_categories')
      .select('id, parent_id')
      .eq('id', hierarchy.micro_category_id)
      .maybeSingle();

    if (microError || !microCategory) {
      errors.push('Micro-category does not exist');
      return { valid: false, errors };
    }

    if (microCategory.parent_id !== hierarchy.sub_category_id) {
      errors.push('Micro-category does not belong to specified sub-category');
      return { valid: false, errors };
    }
  }

  // If nano_category is specified, validate it exists and belongs to micro_category
  if (hierarchy.nano_category_id) {
    if (!hierarchy.micro_category_id) {
      errors.push('Nano-category requires micro-category');
      return { valid: false, errors };
    }

    const { data: nanoCategory, error: nanoError } = await supabase
      .from('nano_categories')
      .select('id, parent_id')
      .eq('id', hierarchy.nano_category_id)
      .maybeSingle();

    if (nanoError || !nanoCategory) {
      errors.push('Nano-category does not exist');
      return { valid: false, errors };
    }

    if (nanoCategory.parent_id !== hierarchy.micro_category_id) {
      errors.push('Nano-category does not belong to specified micro-category');
      return { valid: false, errors };
    }
  }

  return { valid: true, errors: [] };
}

/**
 * Validate product data
 */
export async function validateProductData(product: any): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let rowIndex = 0; // Will be set by caller

  // Required fields
  if (!product.name || product.name.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'name',
      message: 'Product name is required',
      severity: 'error',
    });
  }

  if (!product.slug || product.slug.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'slug',
      message: 'Product slug is required',
      severity: 'error',
    });
  } else {
    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(product.slug)) {
      errors.push({
        row: rowIndex,
        field: 'slug',
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
        severity: 'error',
      });
    }
  }

  if (!product.price || isNaN(product.price)) {
    errors.push({
      row: rowIndex,
      field: 'price',
      message: 'Valid price is required',
      severity: 'error',
    });
  }

  // Validate category hierarchy
  const hierarchy: CategoryHierarchy = {
    category_id: product.category_id,
    sub_category_id: product.sub_category_id,
    micro_category_id: product.micro_category_id,
    nano_category_id: product.nano_category_id,
  };

  const hierarchyValidation = await validateCategoryHierarchy(hierarchy);
  if (!hierarchyValidation.valid) {
    hierarchyValidation.errors.forEach((error) => {
      errors.push({
        row: rowIndex,
        field: 'category_hierarchy',
        message: error,
        severity: 'error',
      });
    });
  }

  // Warnings
  if (!product.description || product.description.trim() === '') {
    warnings.push({
      row: rowIndex,
      field: 'description',
      message: 'Product description is recommended',
    });
  }

  if (!product.image || product.image.trim() === '') {
    warnings.push({
      row: rowIndex,
      field: 'image',
      message: 'Product image is recommended',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate batch of products
 */
export async function validateProductBatch(products: any[]): Promise<{
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validRows: number[];
  invalidRows: number[];
}> {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  const validRows: number[] = [];
  const invalidRows: number[] = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const result = await validateProductData(product);

    // Update row indices
    result.errors.forEach((error) => error.row = i);
    result.warnings.forEach((warning) => warning.row = i);

    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);

    if (result.valid) {
      validRows.push(i);
    } else {
      invalidRows.push(i);
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    validRows,
    invalidRows,
  };
}

/**
 * Validate category data
 */
export async function validateCategoryData(category: any, level: 'category' | 'sub' | 'micro' | 'nano'): Promise<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  let rowIndex = 0; // Will be set by caller

  // Required fields
  if (!category.name || category.name.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'name',
      message: 'Category name is required',
      severity: 'error',
    });
  }

  if (!category.slug || category.slug.trim() === '') {
    errors.push({
      row: rowIndex,
      field: 'slug',
      message: 'Category slug is required',
      severity: 'error',
    });
  } else {
    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(category.slug)) {
      errors.push({
        row: rowIndex,
        field: 'slug',
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
        severity: 'error',
      });
    }
  }

  // Validate parent category for sub/micro/nano levels
  if (level === 'sub' && !category.parent_id) {
    errors.push({
      row: rowIndex,
      field: 'parent_id',
      message: 'Sub-category requires a parent category',
      severity: 'error',
    });
  }

  if (level === 'micro' && !category.parent_id) {
    errors.push({
      row: rowIndex,
      field: 'parent_id',
      message: 'Micro-category requires a parent sub-category',
      severity: 'error',
    });
  }

  if (level === 'nano' && !category.parent_id) {
    errors.push({
      row: rowIndex,
      field: 'parent_id',
      message: 'Nano-category requires a parent micro-category',
      severity: 'error',
    });
  }

  // Warnings
  if (!category.description || category.description.trim() === '') {
    warnings.push({
      row: rowIndex,
      field: 'description',
      message: 'Category description is recommended',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate import data with custom rules
 */
export async function validateImportData(
  data: any[],
  type: 'products' | 'categories' | 'orders',
  options?: { skipInvalid?: boolean; maxErrors?: number }
): Promise<{
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validCount: number;
  invalidCount: number;
}> {
  const { skipInvalid = false, maxErrors = 100 } = options || {};

  let allErrors: ValidationError[] = [];
  let allWarnings: ValidationWarning[] = [];
  let validCount = 0;
  let invalidCount = 0;

  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    let result: ValidationResult;

    switch (type) {
      case 'products':
        result = await validateProductData(item);
        break;
      case 'categories':
        result = await validateCategoryData(item, 'category');
        break;
      case 'orders':
        // Add order validation if needed
        result = { valid: true, errors: [], warnings: [] };
        break;
      default:
        result = { valid: true, errors: [], warnings: [] };
    }

    // Update row indices
    result.errors.forEach((error) => error.row = i);
    result.warnings.forEach((warning) => warning.row = i);

    allErrors.push(...result.errors);
    allWarnings.push(...result.warnings);

    if (result.valid) {
      validCount++;
    } else {
      invalidCount++;
    }

    // Stop if max errors reached
    if (allErrors.length >= maxErrors) {
      break;
    }
  }

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    validCount,
    invalidCount,
  };
}

/**
 * Filter valid rows from batch
 */
export function filterValidRows<T>(
  data: T[],
  validationResults: ValidationResult[]
): T[] {
  return data.filter((_, index) => validationResults[index]?.valid !== false);
}

/**
 * Get validation summary
 */
export function getValidationSummary(validationResult: ValidationResult): {
  totalErrors: number;
  criticalErrors: number;
  totalWarnings: number;
  canProceed: boolean;
} {
  const criticalErrors = validationResult.errors.filter(e => e.severity === 'critical').length;

  return {
    totalErrors: validationResult.errors.length,
    criticalErrors,
    totalWarnings: validationResult.warnings.length,
    canProceed: criticalErrors === 0,
  };
}
