/**
 * Global type definitions for the application
 */

// ============= State Types =============
export interface AppState {
  ffmpegLoaded: boolean;
  ffmpegLoading: boolean;
  uploadedFiles: File[];
  processing: boolean;
  progress: number;
  progressMessage: string;
  result: Uint8Array | null;
  error: string | null;
  currentTool: 'comparison' | 'slideshow' | 'image-redactor';
}

export type StateKey = keyof AppState;
export type StateValue<K extends StateKey> = AppState[K];

// ============= Event Types =============
export type EventCallback<T = unknown> = (data: T) => void;
export type UnsubscribeFunction = () => void;

// ============= Validation Types =============
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

// ============= Image Analysis Types =============
export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageAnalysisResult {
  maxWidth: number;
  maxHeight: number;
  dimensions: ImageDimensions[];
}

// ============= Component Options Types =============
export interface FileUploaderOptions {
  maxFiles?: number;
  multiple?: boolean;
  eventName?: string;
}

export interface DownloadButtonOptions {
  prefix?: string;
  extension?: string;
  mimeType?: string;
}

// ============= FFmpeg Types =============
export interface FFmpegProgressEvent {
  progress: number;
  time?: number;
}

export interface FFmpegLogEvent {
  type: string;
  message: string;
}

export interface FFmpegLoadOptions {
  coreURL: string;
  wasmURL: string;
}

// ============= DOM Element Types =============
export type HTMLElementOrNull = HTMLElement | null;
export type HTMLInputElementOrNull = HTMLInputElement | null;
export type HTMLButtonElementOrNull = HTMLButtonElement | null;
export type HTMLImageElementOrNull = HTMLImageElement | null;
export type HTMLVideoElementOrNull = HTMLVideoElement | null;
