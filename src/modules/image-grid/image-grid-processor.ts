import { ffmpegManager } from '../../core/ffmpeg-manager.ts';
import { stateManager } from '../../core/state-manager.ts';
import { analyzeImages } from '../../utils/image-analyzer.ts';
import { MESSAGES } from '../../config.ts';

export interface GridOptions {
  width: number;
  height: number;
}

export class ImageGridProcessor {
  async process(files: File[], options: GridOptions): Promise<Uint8Array> {
    if (files.length === 0) {
      throw new Error('At least 1 image required');
    }

    let progressSimulation: number | undefined;

    stateManager.setState({
      processing: true,
      progressMessage: MESSAGES.ANALYZING_IMAGES,
      progress: 10
    });

    await analyzeImages(files);

    stateManager.setState({
      progressMessage: 'Generating image grid...',
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

      const outputFile = 'grid.png';

      // Calculate grid layout
      const imageCount = files.length;
      const cols = Math.ceil(Math.sqrt(imageCount));
      const rows = Math.ceil(imageCount / cols);

      // Calculate individual cell dimensions
      const cellWidth = Math.floor(options.width / cols);
      const cellHeight = Math.floor(options.height / rows);

      // Build the FFmpeg filter complex
      // First, scale and pad all images to the same size
      let filterComplex = '';
      for (let i = 0; i < imageCount; i++) {
        filterComplex += `[${i}:v]scale=${cellWidth}:${cellHeight}:force_original_aspect_ratio=decrease,pad=${cellWidth}:${cellHeight}:(ow-iw)/2:(oh-ih)/2[img${i}];`;
      }

      // Build the xstack layout string
      const layoutParts: string[] = [];
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const index = row * cols + col;
          if (index < imageCount) {
            const x = col * cellWidth;
            const y = row * cellHeight;
            layoutParts.push(`${x}_${y}`);
          }
        }
      }

      // Add xstack filter to combine all images
      const inputLabels = Array.from({ length: imageCount }, (_, i) => `[img${i}]`).join('');
      filterComplex += `${inputLabels}xstack=inputs=${imageCount}:layout=${layoutParts.slice(0, imageCount).join('|')}[outv]`;

      // Start a progress simulation
      progressSimulation = setInterval(() => {
        const currentProgress = stateManager.getState('progress') as number;
        if (currentProgress < 85) {
          stateManager.setState({ progress: Math.min(85, currentProgress + 1) });
        }
      }, 1000) as unknown as number;

      // Execute FFmpeg command
      const ffmpegArgs = [
        ...inputFiles.flatMap(f => ['-i', f]),
        '-filter_complex', filterComplex,
        '-map', '[outv]',
        '-y',
        outputFile
      ];

      await ffmpegManager.execute(ffmpegArgs);

      stateManager.setState({ progress: 90 });

      const result = await ffmpegManager.readFile(outputFile);

      await ffmpegManager.cleanup([...inputFiles, outputFile]);

      stateManager.setState({
        progress: 100,
        progressMessage: MESSAGES.PROCESSING_COMPLETE
      });

      return result;

    } catch (error) {
      console.error('Image grid processing error:', error);
      throw new Error(MESSAGES.ERROR_PROCESSING);
    } finally {
      if (progressSimulation !== undefined) {
        clearInterval(progressSimulation);
      }
      stateManager.setState({ processing: false });
    }
  }

  private getExtension(file: File): string {
    const parts = file.name.split('.');
    return parts.pop()?.toLowerCase() ?? 'jpg';
  }
}
