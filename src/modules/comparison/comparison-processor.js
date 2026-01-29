import { ffmpegManager } from '../../core/ffmpeg-manager.js';
import { stateManager } from '../../core/state-manager.js';
import { analyzeImages, calculateCommonHeight } from '../../utils/image-analyzer.js';
import { MESSAGES } from '../../config.js';

/**
 * Comparison processor for combining two images side-by-side
 */
export class ComparisonProcessor {
  /**
   * Generate side-by-side comparison image
   * @param {File[]} files - Two image files
   * @returns {Promise<Uint8Array>} PNG image data
   */
  async process(files) {
    if (files.length !== 2) {
      throw new Error('Exactly 2 images required');
    }

    stateManager.setState({
      processing: true,
      progressMessage: MESSAGES.ANALYZING_IMAGES,
      progress: 10
    });

    // Analyze images to get dimensions
    const { dimensions } = await analyzeImages(files);
    const commonHeight = calculateCommonHeight(dimensions);

    stateManager.setState({
      progressMessage: MESSAGES.GENERATING_COMPARISON,
      progress: 30
    });

    // Initialize FFmpeg if needed
    const ffmpegReady = await ffmpegManager.initialize();
    if (!ffmpegReady) {
      throw new Error(MESSAGES.ERROR_FFMPEG_LOAD);
    }

    stateManager.setState({ progress: 50 });

    try {
      // Write input files to FFmpeg
      const inputFiles = [];
      for (let i = 0; i < files.length; i++) {
        const filename = `input${i}.${this.getExtension(files[i])}`;
        await ffmpegManager.writeFile(filename, files[i]);
        inputFiles.push(filename);
      }

      stateManager.setState({ progress: 60 });

      const outputFile = 'comparison.png';

      // Build FFmpeg command for side-by-side comparison
      // Scale both images to same height, preserving aspect ratio
      const filterComplex = 
        `[0:v]scale=-1:${commonHeight}[left];` +
        `[1:v]scale=-1:${commonHeight}[right];` +
        `[left][right]hstack=inputs=2[outv]`;

      // Execute FFmpeg
      await ffmpegManager.execute([
        '-i', inputFiles[0],
        '-i', inputFiles[1],
        '-filter_complex', filterComplex,
        '-map', '[outv]',
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
      console.error('Comparison processing error:', error);
      throw new Error(MESSAGES.ERROR_PROCESSING);
    } finally {
      stateManager.setState({ processing: false });
    }
  }

  /**
   * Get file extension
   * @param {File} file 
   * @returns {string}
   */
  getExtension(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    return ext === 'jpg' ? 'jpeg' : ext;
  }
}
