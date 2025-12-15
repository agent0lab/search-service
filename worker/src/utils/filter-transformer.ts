/**
 * Transform standard filter format to Pinecone-compatible format
 */
import type { StandardFilters } from './standard-types.js';
import type { SemanticSearchFilters } from './types.js';

/**
 * Transform standard filter operators to Pinecone-compatible filters
 * Note: exists/notExists operators require post-filtering as Pinecone doesn't support them natively
 */
export function transformStandardFiltersToPinecone(
  filters: StandardFilters
): { pineconeFilter: SemanticSearchFilters | undefined; requiresPostFilter: boolean; postFilter?: (metadata: Record<string, unknown>) => boolean } {
  const pineconeFilter: SemanticSearchFilters = {};
  const existsFields: string[] = [];
  const notExistsFields: string[] = [];

  // Handle equals operator - direct value assignment
  if (filters.equals) {
    for (const [field, value] of Object.entries(filters.equals)) {
      pineconeFilter[field] = value;
    }
  }

  // Handle in operator - use $in format
  if (filters.in) {
    for (const [field, values] of Object.entries(filters.in)) {
      if (Array.isArray(values) && values.length > 0) {
        // Pinecone uses $in for array matching
        pineconeFilter[field] = { $in: values };
      }
    }
  }

  // Handle notIn operator - use $nin format (if supported) or post-filter
  if (filters.notIn) {
    for (const [field, values] of Object.entries(filters.notIn)) {
      if (Array.isArray(values) && values.length > 0) {
        // Pinecone may support $nin, but we'll use $nin for now
        // If not supported, we'll need post-filtering
        pineconeFilter[field] = { $nin: values };
      }
    }
  }

  // Handle exists operator - requires post-filtering
  if (filters.exists && filters.exists.length > 0) {
    existsFields.push(...filters.exists);
  }

  // Handle notExists operator - requires post-filtering
  if (filters.notExists && filters.notExists.length > 0) {
    notExistsFields.push(...filters.notExists);
  }

  // Create post-filter function if needed
  const requiresPostFilter = existsFields.length > 0 || notExistsFields.length > 0;
  let postFilter: ((metadata: Record<string, unknown>) => boolean) | undefined;

  if (requiresPostFilter) {
    postFilter = (metadata: Record<string, unknown>): boolean => {
      // Check exists fields
      for (const field of existsFields) {
        if (metadata[field] === undefined || metadata[field] === null) {
          return false;
        }
      }

      // Check notExists fields
      for (const field of notExistsFields) {
        if (metadata[field] !== undefined && metadata[field] !== null) {
          return false;
        }
      }

      return true;
    };
  }

  return {
    pineconeFilter: Object.keys(pineconeFilter).length > 0 ? pineconeFilter : undefined,
    requiresPostFilter,
    postFilter,
  };
}

/**
 * Map standard filter field names to metadata field names
 * This handles any field name differences between the API standard and internal storage
 */
export function mapStandardFieldToMetadata(field: string): string {
  // Most fields map directly, but we can add mappings here if needed
  // For example, if the API uses 'chainId' but we store it as 'chain_id'
  const fieldMap: Record<string, string> = {
    // Add any field mappings here
  };

  return fieldMap[field] || field;
}

/**
 * Apply field mapping to all filter fields
 */
export function applyFieldMapping(filters: StandardFilters): StandardFilters {
  const mapped: StandardFilters = {};

  if (filters.equals) {
    mapped.equals = {};
    for (const [field, value] of Object.entries(filters.equals)) {
      mapped.equals[mapStandardFieldToMetadata(field)] = value;
    }
  }

  if (filters.in) {
    mapped.in = {};
    for (const [field, values] of Object.entries(filters.in)) {
      mapped.in[mapStandardFieldToMetadata(field)] = values;
    }
  }

  if (filters.notIn) {
    mapped.notIn = {};
    for (const [field, values] of Object.entries(filters.notIn)) {
      mapped.notIn[mapStandardFieldToMetadata(field)] = values;
    }
  }

  if (filters.exists) {
    mapped.exists = filters.exists.map(mapStandardFieldToMetadata);
  }

  if (filters.notExists) {
    mapped.notExists = filters.notExists.map(mapStandardFieldToMetadata);
  }

  return mapped;
}

