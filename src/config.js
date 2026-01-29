/**
 * Application configuration constants
 */
export const CONFIG = {
  MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB
  MAX_FILES_SLIDESHOW: 20,
  ACCEPTED_FORMATS: ['.png', '.jpg', '.jpeg'],
  ACCEPTED_MIME_TYPES: ['image/png', 'image/jpeg'],
  DISPLAY_DURATION: 1.5,
  TRANSITION_DURATION: 0.5,
  VIDEO_FPS: 30,
  FFMPEG_CDN: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm',
  // Duration input constraints
  DISPLAY_DURATION_MIN: 0.5,
  DISPLAY_DURATION_MAX: 10,
  DISPLAY_DURATION_STEP: 0.5,
  TRANSITION_DURATION_MIN: 0.1,
  TRANSITION_DURATION_MAX: 3,
  TRANSITION_DURATION_STEP: 0.1
};

export const MESSAGES = {
  LOADING_FFMPEG: 'Loading FFmpeg (one-time, ~10MB)...',
  ANALYZING_IMAGES: 'Analyzing images...',
  GENERATING_VIDEO: 'Generating video...',
  GENERATING_COMPARISON: 'Generating comparison...',
  PROCESSING_COMPLETE: 'Processing complete!',
  ERROR_FILE_TOO_LARGE: 'File size exceeds 50MB limit',
  ERROR_INVALID_FORMAT: 'Only PNG and JPG images are supported',
  ERROR_MAX_FILES: 'Maximum 20 images allowed',
  ERROR_MIN_FILES_COMPARISON: 'Please upload exactly 2 images',
  ERROR_MIN_FILES_SLIDESHOW: 'Please upload at least 2 images',
  ERROR_FFMPEG_LOAD: 'Failed to load FFmpeg. Please try again.',
  ERROR_PROCESSING: 'An error occurred during processing',
  ERROR_NO_SHAREDARRAYBUFFER: 'Your browser does not support SharedArrayBuffer. Please use a modern browser with CORS isolation.'
};
