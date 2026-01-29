import { CONFIG, MESSAGES } from '../config.js';

/**
 * Validate a single file
 * @param {File} file - File to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file) {
  // Check file type
  const extension = '.' + file.name.split('.').pop().toLowerCase();
  if (!CONFIG.ACCEPTED_FORMATS.includes(extension)) {
    return { valid: false, error: MESSAGES.ERROR_INVALID_FORMAT };
  }

  // Check MIME type
  if (!CONFIG.ACCEPTED_MIME_TYPES.includes(file.type)) {
    return { valid: false, error: MESSAGES.ERROR_INVALID_FORMAT };
  }

  // Check file size
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    return { valid: false, error: MESSAGES.ERROR_FILE_TOO_LARGE };
  }

  return { valid: true };
}

/**
 * Validate files for comparison tool
 * @param {File[]} files - Files to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateComparisonFiles(files) {
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

/**
 * Validate files for slideshow tool
 * @param {File[]} files - Files to validate
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSlideshowFiles(files) {
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
