import { ffmpegManager } from '../../core/ffmpeg-manager.ts';
import { stateManager } from '../../core/state-manager.ts';
import { analyzeImages, calculateCommonHeight } from '../../utils/image-analyzer.ts';
import { MESSAGES } from '../../config.ts';

export class ComparisonProcessor {
  async process(files: File[]): Promise<Uint8Array> {
    if (files.length !== 2) {
      throw new Error('Exactly 2 images required');
    }

    stateManager.setState({
      processing: true,
      progressMessage: MESSAGES.ANALYZING_IMAGES,
      progress: 10
    });

    const { dimensions } = await analyzeImages(files);
    const commonHeight = calculateCommonHeight(dimensions);

    stateManager.setState({
      progressMessage: MESSAGES.GENERATING_COMPARISON,
      progress: 30
    });

    const ffmpegReady = await ffmpegManager.initialize();
    if (!ffmpegReady) {
      throw new Error(MESSAGES.ERROR_FFMPEG_LOAD);
    }

    stateManager.setState({ progress: 50 });

    try {
      const inputFiles: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        
        const filename = `input${i}.${this.getExtension(file)}`;
        await ffmpegManager.writeFile(filename, file);
        inputFiles.push(filename);
      }

      stateManager.setState({ progress: 60 });

      const outputFile = 'comparison.png';

      const filterComplex = 
        `[0:v]scale=-1:${commonHeight}[left];` +
        `[1:v]scale=-1:${commonHeight}[right];` +
        `[left][right]hstack=inputs=2[outv]`;

      const input0 = inputFiles[0];
      const input1 = inputFiles[1];
      
      if (!input0 || !input1) {
        throw new Error('Failed to process input files');
      }

      await ffmpegManager.execute([
        '-i', input0,
        '-i', input1,
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-y',
        outputFile
      ]);

      stateManager.setState({ progress: 90 });

      const result = await ffmpegManager.readFile(outputFile);

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

  private getExtension(file: File): string {
    const parts = file.name.split('.');
    return parts.pop()?.toLowerCase() ?? 'jpg';
  }
}
