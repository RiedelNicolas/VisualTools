import { ffmpegManager } from '../../core/ffmpeg-manager.js';
import { stateManager } from '../../core/state-manager.js';
import { analyzeImages } from '../../utils/image-analyzer.js';
import { CONFIG, MESSAGES } from '../../config.js';

/**
 * Slideshow processor for generating video from images with crossfade transitions
 * Based on the logic from generate_video.sh
 */
export class SlideshowProcessor {
  constructor() {
    this.displayDuration = CONFIG.DISPLAY_DURATION;
    this.transitionDuration = CONFIG.TRANSITION_DURATION;
    this.fps = CONFIG.VIDEO_FPS;
  }

  /**
   * Generate slideshow video from images
   * @param {File[]} files - Image files
   * @returns {Promise<Uint8Array>} MP4 video data
   */
  async process(files) {
    if (files.length < 2) {
      throw new Error('At least 2 images required');
    }

    stateManager.setState({
      processing: true,
      progressMessage: MESSAGES.ANALYZING_IMAGES,
      progress: 5
    });

    // Analyze images to get max dimensions
    const { maxWidth, maxHeight } = await analyzeImages(files);
    
    // Ensure dimensions are even (required for video encoding)
    const width = maxWidth + (maxWidth % 2);
    const height = maxHeight + (maxHeight % 2);

    stateManager.setState({
      progressMessage: MESSAGES.LOADING_FFMPEG,
      progress: 10
    });

    // Initialize FFmpeg if needed
    const ffmpegReady = await ffmpegManager.initialize();
    if (!ffmpegReady) {
      throw new Error(MESSAGES.ERROR_FFMPEG_LOAD);
    }

    stateManager.setState({
      progressMessage: MESSAGES.GENERATING_VIDEO,
      progress: 20
    });

    try {
      // Write input files to FFmpeg
      const inputFiles = [];
      for (let i = 0; i < files.length; i++) {
        const filename = `input${i}.${this.getExtension(files[i])}`;
        await ffmpegManager.writeFile(filename, files[i]);
        inputFiles.push(filename);
        
        // Update progress for file uploads
        const uploadProgress = 20 + Math.floor((i / files.length) * 20);
        stateManager.setState({ progress: uploadProgress });
      }

      stateManager.setState({ progress: 40 });

      const outputFile = 'slideshow.mp4';

      // Build FFmpeg command
      const { inputs, filterComplex } = this.buildFilterComplex(
        inputFiles.length,
        width,
        height
      );

      // Build input arguments
      const inputArgs = [];
      for (const file of inputFiles) {
        inputArgs.push('-i', file);
      }

      // Execute FFmpeg
      await ffmpegManager.execute([
        ...inputArgs,
        '-filter_complex', filterComplex,
        '-map', '[vfinal]',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-movflags', '+faststart',
        '-y',
        outputFile
      ]);

      stateManager.setState({ progress: 90 });

      // Read output
      const result = await ffmpegManager.readFile(outputFile);

      // Cleanup
      await ffmpegManager.cleanup([...inputFiles, outputFile]);

      stateManager.setState({
        progress: 100,
        progressMessage: MESSAGES.PROCESSING_COMPLETE
      });

      return result;

    } catch (error) {
      console.error('Slideshow processing error:', error);
      throw new Error(MESSAGES.ERROR_PROCESSING);
    } finally {
      stateManager.setState({ processing: false });
    }
  }

  /**
   * Calculate duration for each image
   * First and last images: displayDuration + transitionDuration/2
   * Middle images: displayDuration + transitionDuration
   * 
   * @param {number} index - Image index
   * @param {number} total - Total number of images
   * @returns {number} Duration in seconds
   */
  calculateDuration(index, total) {
    if (index === 0 || index === total - 1) {
      // First or last image
      return this.displayDuration + this.transitionDuration / 2;
    }
    // Middle images
    return this.displayDuration + this.transitionDuration;
  }

  /**
   * Build FFmpeg filter complex string
   * @param {number} numImages - Number of images
   * @param {number} width - Output width
   * @param {number} height - Output height
   * @returns {{ inputs: string[], filterComplex: string }}
   */
  buildFilterComplex(numImages, width, height) {
    const filters = [];
    
    // First, scale and pad each input image
    for (let i = 0; i < numImages; i++) {
      const duration = this.calculateDuration(i, numImages);
      filters.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
        `setsar=1,fps=${this.fps},format=yuva420p,` +
        `trim=duration=${duration},setpts=PTS-STARTPTS[v${i}]`
      );
    }

    // Calculate offsets and build xfade transitions
    let offset = this.displayDuration;
    
    for (let i = 0; i < numImages - 1; i++) {
      const inputA = i === 0 ? `v${i}` : `vout${i}`;
      const inputB = `v${i + 1}`;
      const outputLabel = i === numImages - 2 ? `vfinal` : `vout${i + 1}`;
      
      filters.push(
        `[${inputA}][${inputB}]xfade=transition=fade:duration=${this.transitionDuration}:offset=${offset.toFixed(2)}[${outputLabel}]`
      );
      
      // Next offset = current offset + display duration
      offset += this.displayDuration;
    }

    return {
      filterComplex: filters.join(';')
    };
  }

  /**
   * Get file extension
   * @param {File} file 
   * @returns {string}
   */
  getExtension(file) {
    return file.name.split('.').pop().toLowerCase();
  }
}
