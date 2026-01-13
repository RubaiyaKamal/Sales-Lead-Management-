/**
 * Input Validation Utilities
 *
 * Provides validation functions for common data types:
 * - Email format (RFC 5322)
 * - E.164 phone format
 * - Field lengths
 * - Enum values
 */

import Joi from 'joi';
import { ValidationError } from '../api/middleware/errorHandler';
import {
  LeadSource,
  LeadStatus,
  QualificationStatus,
  CreateLeadRequest,
  UpdateLeadRequest,
} from '../models/Lead';
import { UserRole } from '../models/User';

/**
 * Email validation regex (simplified RFC 5322)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E.164 phone format regex
 * Format: +[country code][number] (e.g., +12025551234)
 * Length: 1-15 digits after the +
 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

/**
 * UUID validation regex (version 4)
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validate E.164 phone format
 */
export function isValidE164Phone(phone: string): boolean {
  return E164_PHONE_REGEX.test(phone);
}

/**
 * Validate UUID format
 */
export function isValidUUID(uuid: string): boolean {
  return UUID_REGEX.test(uuid);
}

/**
 * Validate string length
 */
export function isValidLength(
  value: string,
  min: number,
  max: number
): boolean {
  const length = value.trim().length;
  return length >= min && length <= max;
}

/**
 * Validate enum value
 */
export function isValidEnum<T extends string>(
  value: string,
  enumObj: Record<string, T>
): value is T {
  return Object.values(enumObj).includes(value as T);
}

/**
 * Joi schema for creating leads
 */
const createLeadSchema = Joi.object<CreateLeadRequest>({
  name: Joi.string().trim().min(1).max(255).required().messages({
    'string.empty': 'Name is required',
    'string.min': 'Name must be at least 1 character',
    'string.max': 'Name must not exceed 255 characters',
    'any.required': 'Name is required',
  }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255)
    .required()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Email must be a valid email address',
      'string.max': 'Email must not exceed 255 characters',
      'any.required': 'Email is required',
    }),

  phone: Joi.string()
    .trim()
    .pattern(E164_PHONE_REGEX)
    .max(20)
    .optional()
    .allow(null)
    .messages({
      'string.pattern.base':
        'Phone must be in E.164 format (e.g., +12025551234)',
      'string.max': 'Phone must not exceed 20 characters',
    }),

  company: Joi.string().trim().max(255).optional().allow(null).messages({
    'string.max': 'Company must not exceed 255 characters',
  }),

  leadSource: Joi.string()
    .valid(...Object.values(LeadSource))
    .required()
    .messages({
      'any.only': `Lead source must be one of: ${Object.values(LeadSource).join(', ')}`,
      'any.required': 'Lead source is required',
    }),

  metadata: Joi.object().optional().default({}).messages({
    'object.base': 'Metadata must be a valid JSON object',
  }),
});

/**
 * Joi schema for updating leads
 */
const updateLeadSchema = Joi.object<UpdateLeadRequest>({
  name: Joi.string().trim().min(1).max(255).optional().messages({
    'string.empty': 'Name cannot be empty',
    'string.min': 'Name must be at least 1 character',
    'string.max': 'Name must not exceed 255 characters',
  }),

  email: Joi.string()
    .trim()
    .lowercase()
    .email({ tlds: { allow: false } })
    .max(255)
    .optional()
    .messages({
      'string.email': 'Email must be a valid email address',
      'string.max': 'Email must not exceed 255 characters',
    }),

  phone: Joi.string()
    .trim()
    .pattern(E164_PHONE_REGEX)
    .max(20)
    .optional()
    .allow(null)
    .messages({
      'string.pattern.base':
        'Phone must be in E.164 format (e.g., +12025551234)',
      'string.max': 'Phone must not exceed 20 characters',
    }),

  company: Joi.string().trim().max(255).optional().allow(null).messages({
    'string.max': 'Company must not exceed 255 characters',
  }),

  status: Joi.string()
    .valid(...Object.values(LeadStatus))
    .optional()
    .messages({
      'any.only': `Status must be one of: ${Object.values(LeadStatus).join(', ')}`,
    }),

  assigned_to: Joi.string()
    .pattern(UUID_REGEX)
    .optional()
    .allow(null)
    .messages({
      'string.pattern.base': 'Assigned user ID must be a valid UUID',
    }),

  metadata: Joi.object().optional().messages({
    'object.base': 'Metadata must be a valid JSON object',
  }),

  previous_updated_at: Joi.string().isoDate().optional().messages({
    'string.isoDate': 'Previous updated at must be a valid ISO date string',
  }),
}); // At least one field must be provided for update removed to allow empty updates

/**
 * Joi schema for lead list query parameters
 */
const leadListQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1',
  }),

  limit: Joi.number().integer().min(1).max(100).default(20).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit must not exceed 100',
  }),

  status: Joi.string()
    .valid(...Object.values(LeadStatus))
    .optional()
    .messages({
      'any.only': `Status must be one of: ${Object.values(LeadStatus).join(', ')}`,
    }),

  qualification_status: Joi.string()
    .valid(...Object.values(QualificationStatus))
    .optional()
    .messages({
      'any.only': `Qualification status must be one of: ${Object.values(QualificationStatus).join(', ')}`,
    }),

  lead_source: Joi.string()
    .valid(...Object.values(LeadSource))
    .optional()
    .messages({
      'any.only': `Lead source must be one of: ${Object.values(LeadSource).join(', ')}`,
    }),

  assigned_to: Joi.string().pattern(UUID_REGEX).optional().messages({
    'string.pattern.base': 'Assigned user ID must be a valid UUID',
  }),

  search: Joi.string().trim().max(255).optional().messages({
    'string.max': 'Search query must not exceed 255 characters',
  }),

  sortBy: Joi.string()
    .valid('created_at', 'updated_at', 'name', 'company')
    .default('created_at')
    .messages({
      'any.only':
        'Sort by must be one of: created_at, updated_at, name, company',
    }),

  sortOrder: Joi.string().valid('asc', 'desc').default('desc').messages({
    'any.only': 'Sort order must be either asc or desc',
  }),
});

/**
 * Validate create lead request
 * @throws ValidationError if validation fails
 */
export function validateCreateLead(data: any): CreateLeadRequest {
  const { error, value } = createLeadSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    throw new ValidationError('Lead validation failed', details);
  }

  return value;
}

/**
 * Validate update lead request
 * @throws ValidationError if validation fails
 */
export function validateUpdateLead(data: any): UpdateLeadRequest {
  const { error, value } = updateLeadSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    throw new ValidationError('Lead update validation failed', details);
  }

  return value;
}

/**
 * Validate lead list query parameters
 * @throws ValidationError if validation fails
 */
export function validateLeadListQuery(data: any): {
  page: number;
  limit: number;
  status?: LeadStatus;
  qualification_status?: QualificationStatus;
  lead_source?: LeadSource;
  assigned_to?: string;
  search?: string;
  sortBy: 'created_at' | 'updated_at' | 'name' | 'company';
  sortOrder: 'asc' | 'desc';
} {
  const { error, value } = leadListQuerySchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message,
    }));

    throw new ValidationError('Query parameters validation failed', details);
  }

  return value;
}

/**
 * Validate UUID parameter (e.g., lead ID from route params)
 * @throws ValidationError if validation fails
 */
export function validateUUID(value: string, fieldName: string = 'ID'): string {
  if (!isValidUUID(value)) {
    throw new ValidationError(`Invalid ${fieldName}`, [
      {
        field: fieldName.toLowerCase(),
        message: `${fieldName} must be a valid UUID`,
      },
    ]);
  }

  return value;
}

/**
 * Sanitize string input (trim and remove null characters)
 */
export function sanitizeString(value: string): string {
  return value.trim().replace(/\0/g, '');
}

/**
 * Validate and sanitize search query
 */
export function validateSearchQuery(query: string): string {
  const sanitized = sanitizeString(query);

  if (sanitized.length > 255) {
    throw new ValidationError('Search query too long', [
      {
        field: 'search',
        message: 'Search query must not exceed 255 characters',
      },
    ]);
  }

  return sanitized;
}

/**
 * Validate pagination parameters
 */
export function validatePagination(page?: number, limit?: number): {
  page: number;
  limit: number;
} {
  const validatedPage = Math.max(1, page || 1);
  const validatedLimit = Math.min(100, Math.max(1, limit || 20));

  return {
    page: validatedPage,
    limit: validatedLimit,
  };
}

/**
 * Validate user role enum
 */
export function validateUserRole(role: string): UserRole {
  if (!isValidEnum(role, UserRole)) {
    throw new ValidationError('Invalid user role', [
      {
        field: 'role',
        message: `Role must be one of: ${Object.values(UserRole).join(', ')}`,
      },
    ]);
  }

  return role as UserRole;
}
