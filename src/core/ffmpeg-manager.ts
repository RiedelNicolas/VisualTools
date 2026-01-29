import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { stateManager } from './state-manager.ts';
import { CONFIG, MESSAGES } from '../config.ts';
import type { FFmpegProgressEvent, FFmpegLogEvent } from '../types.ts';

class FFmpegManager {
  private ffmpeg: FFmpeg | null;
  private loaded: boolean;

  constructor() {
    this.ffmpeg = null;
    this.loaded = false;
  }

  async initialize(): Promise<boolean> {
    if (this.loaded) {
      return true;
    }

    if (stateManager.getState('ffmpegLoading')) {
      return new Promise<boolean>((resolve) => {
        const unsubscribe = stateManager.subscribe('ffmpegLoaded', (loaded) => {
          unsubscribe();
          resolve(loaded as boolean);
        });
      });
    }

    if (typeof SharedArrayBuffer === 'undefined') {
      stateManager.setState({ error: MESSAGES.ERROR_NO_SHAREDARRAYBUFFER });
      return false;
    }

    stateManager.setState({
      ffmpegLoading: true,
      progressMessage: MESSAGES.LOADING_FFMPEG,
      progress: 0
    });

    try {
      this.ffmpeg = new FFmpeg();

      this.ffmpeg.on('progress', ({ progress }: FFmpegProgressEvent) => {
        stateManager.setState({ progress: Math.round(progress * 100) });
      });

      this.ffmpeg.on('log', ({ message }: FFmpegLogEvent) => {
        console.log('[FFmpeg]', message);
      });

      await this.ffmpeg.load({
        coreURL: `${CONFIG.FFMPEG_CDN}/ffmpeg-core.js`,
        wasmURL: `${CONFIG.FFMPEG_CDN}/ffmpeg-core.wasm`
      });

      this.loaded = true;
      stateManager.setState({
        ffmpegLoaded: true,
        ffmpegLoading: false,
        progress: 100
      });

      return true;
    } catch (error) {
      console.error('Failed to load FFmpeg:', error);
      stateManager.setState({
        ffmpegLoading: false,
        error: MESSAGES.ERROR_FFMPEG_LOAD
      });
      return false;
    }
  }

  async execute(args: string[]): Promise<void> {
    if (!this.loaded || !this.ffmpeg) {
      throw new Error('FFmpeg not loaded');
    }
    await this.ffmpeg.exec(args);
  }

  async writeFile(filename: string, data: File | Blob | Uint8Array): Promise<void> {
    if (!this.loaded || !this.ffmpeg) {
      throw new Error('FFmpeg not loaded');
    }
    
    if (data instanceof File || data instanceof Blob) {
      const buffer = await fetchFile(data);
      await this.ffmpeg.writeFile(filename, buffer);
    } else {
      await this.ffmpeg.writeFile(filename, data);
    }
  }

  async readFile(filename: string): Promise<Uint8Array> {
    if (!this.loaded || !this.ffmpeg) {
      throw new Error('FFmpeg not loaded');
    }
    const data = await this.ffmpeg.readFile(filename);
    return data as Uint8Array;
  }

  async deleteFile(filename: string): Promise<void> {
    if (!this.loaded || !this.ffmpeg) {
      return;
    }
    try {
      await this.ffmpeg.deleteFile(filename);
    } catch (error) {
      if (error instanceof Error && !error.message.includes('ENOENT')) {
        console.warn(`[FFmpeg] Could not delete file ${filename}:`, error.message);
      }
    }
  }

  async cleanup(filenames: string[]): Promise<void> {
    for (const filename of filenames) {
      await this.deleteFile(filename);
    }
  }

  terminate(): void {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.loaded = false;
      stateManager.setState({ ffmpegLoaded: false });
    }
  }
}

export const ffmpegManager = new FFmpegManager();
