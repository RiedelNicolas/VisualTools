import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';
import { stateManager } from './state-manager.js';
import { CONFIG, MESSAGES } from '../config.js';

/**
 * FFmpeg manager singleton for handling FFmpeg.wasm lifecycle
 */
class FFmpegManager {
  constructor() {
    this.ffmpeg = null;
    this.loaded = false;
  }

  /**
   * Initialize and load FFmpeg
   * @returns {Promise<boolean>}
   */
  async initialize() {
    if (this.loaded) {
      return true;
    }

    if (stateManager.getState('ffmpegLoading')) {
      // Wait for ongoing load to complete
      return new Promise((resolve) => {
        const unsubscribe = stateManager.subscribe('ffmpegLoaded', (loaded) => {
          unsubscribe();
          resolve(loaded);
        });
      });
    }

    // Check for SharedArrayBuffer support
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

      // Set up progress callback
      this.ffmpeg.on('progress', ({ progress }) => {
        stateManager.setState({ progress: Math.round(progress * 100) });
      });

      this.ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      // Load FFmpeg from CDN
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

  /**
   * Execute FFmpeg command
   * @param {string[]} args - FFmpeg command arguments
   * @returns {Promise<void>}
   */
  async execute(args) {
    if (!this.loaded) {
      throw new Error('FFmpeg not loaded');
    }
    await this.ffmpeg.exec(args);
  }

  /**
   * Write file to FFmpeg virtual filesystem
   * @param {string} filename - Filename in virtual FS
   * @param {File|Blob|Uint8Array} data - File data
   */
  async writeFile(filename, data) {
    if (!this.loaded) {
      throw new Error('FFmpeg not loaded');
    }
    
    if (data instanceof File || data instanceof Blob) {
      const buffer = await fetchFile(data);
      await this.ffmpeg.writeFile(filename, buffer);
    } else {
      await this.ffmpeg.writeFile(filename, data);
    }
  }

  /**
   * Read file from FFmpeg virtual filesystem
   * @param {string} filename - Filename in virtual FS
   * @returns {Promise<Uint8Array>}
   */
  async readFile(filename) {
    if (!this.loaded) {
      throw new Error('FFmpeg not loaded');
    }
    return await this.ffmpeg.readFile(filename);
  }

  /**
   * Delete file from FFmpeg virtual filesystem
   * @param {string} filename - Filename in virtual FS
   */
  async deleteFile(filename) {
    if (!this.loaded) {
      return;
    }
    try {
      await this.ffmpeg.deleteFile(filename);
    } catch {
      // File may not exist, ignore
    }
  }

  /**
   * Clean up virtual filesystem
   * @param {string[]} filenames - Files to delete
   */
  async cleanup(filenames) {
    for (const filename of filenames) {
      await this.deleteFile(filename);
    }
  }

  /**
   * Terminate FFmpeg instance
   */
  terminate() {
    if (this.ffmpeg) {
      this.ffmpeg.terminate();
      this.ffmpeg = null;
      this.loaded = false;
      stateManager.setState({ ffmpegLoaded: false });
    }
  }
}

// Export singleton instance
export const ffmpegManager = new FFmpegManager();
