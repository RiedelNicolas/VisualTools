import { CONFIG, MESSAGES } from '../config.ts';
import type { ValidationResult } from '../types.ts';

export function validateFile(file: File): ValidationResult {
  const extension = '.' + file.name.split('.').pop()?.toLowerCase();
  if (!CONFIG.ACCEPTED_FORMATS.includes(extension)) {
    return { valid: false, error: MESSAGES.ERROR_INVALID_FORMAT };
  }

  if (!CONFIG.ACCEPTED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: MESSAGES.ERROR_INVALID_FORMAT };
  }

  if (file.size > CONFIG.MAX_FILE_SIZE) {
    return { valid: false, error: MESSAGES.ERROR_FILE_TOO_LARGE };
  }

  return { valid: true };
}

export function validateComparisonFiles(files: File[]): ValidationResult {
  if (files.length !== 2) {
    return { valid: false, error: MESSAGES.ERROR_MIN_FILES_COMPARISON };
  }

  for (const file of files) {
    const result = validateFile(file);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}

export function validateSlideshowFiles(files: File[]): ValidationResult {
  if (files.length < 2) {
    return { valid: false, error: MESSAGES.ERROR_MIN_FILES_SLIDESHOW };
  }

  if (files.length > CONFIG.MAX_FILES_SLIDESHOW) {
    return { valid: false, error: MESSAGES.ERROR_MAX_FILES };
  }

  for (const file of files) {
    const result = validateFile(file);
    if (!result.valid) {
      return result;
    }
  }

  return { valid: true };
}
