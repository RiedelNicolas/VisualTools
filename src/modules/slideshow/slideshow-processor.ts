import { ffmpegManager } from '../../core/ffmpeg-manager.ts';
import { stateManager } from '../../core/state-manager.ts';
import { analyzeImages } from '../../utils/image-analyzer.ts';
import { CONFIG, MESSAGES } from '../../config.ts';

export class SlideshowProcessor {
  displayDuration: number;
  transitionDuration: number;
  private fps: number;

  constructor() {
    this.displayDuration = CONFIG.DISPLAY_DURATION;
    this.transitionDuration = CONFIG.TRANSITION_DURATION;
    this.fps = CONFIG.VIDEO_FPS;
  }

  async process(files: File[]): Promise<Uint8Array> {
    if (files.length < 2) {
      throw new Error('At least 2 images required');
    }

    stateManager.setState({
      processing: true,
      progressMessage: MESSAGES.ANALYZING_IMAGES,
      progress: 5
    });

    const { maxWidth, maxHeight } = await analyzeImages(files);
    
    const width = maxWidth + (maxWidth % 2);
    const height = maxHeight + (maxHeight % 2);

    stateManager.setState({
      progressMessage: MESSAGES.LOADING_FFMPEG,
      progress: 10
    });

    const ffmpegReady = await ffmpegManager.initialize();
    if (!ffmpegReady) {
      throw new Error(MESSAGES.ERROR_FFMPEG_LOAD);
    }

    stateManager.setState({
      progressMessage: MESSAGES.GENERATING_VIDEO,
      progress: 20
    });

    try {
      const inputFiles: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        
        const filename = `input${i}.${this.getExtension(file)}`;
        await ffmpegManager.writeFile(filename, file);
        inputFiles.push(filename);
        
        const uploadProgress = 20 + Math.floor((i / files.length) * 20);
        stateManager.setState({ progress: uploadProgress });
      }

      stateManager.setState({ progress: 40 });

      const outputFile = 'slideshow.mp4';

      const { filterComplex } = this.buildFilterComplex(
        inputFiles.length,
        width,
        height
      );

      const inputArgs: string[] = [];
      for (const file of inputFiles) {
        inputArgs.push('-i', file);
      }

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

      const result = await ffmpegManager.readFile(outputFile);

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

  private calculateDuration(index: number, total: number): number {
    if (index === 0 || index === total - 1) {
      return this.displayDuration + this.transitionDuration / 2;
    }
    return this.displayDuration + this.transitionDuration;
  }

  private buildFilterComplex(numImages: number, width: number, height: number): { filterComplex: string } {
    const filters: string[] = [];
    
    // First, scale and pad each input image, then convert to video with loop
    for (let i = 0; i < numImages; i++) {
      const duration = this.calculateDuration(i, numImages);
      const frameCount = Math.ceil(duration * this.fps);
      // loop filter: loop=N means loop N times (original + N loops = N+1 frames total)
      // For frameCount frames, we need to loop (frameCount - 1) times
      const loopCount = Math.max(0, frameCount - 1);
      filters.push(
        `[${i}:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,` +
        `setsar=1,fps=${this.fps},format=yuva420p,` +
        `loop=loop=${loopCount}:size=1:start=0,` +
        `trim=duration=${duration},setpts=PTS-STARTPTS[v${i}]`
      );
    }

    let offset = this.displayDuration;
    
    for (let i = 0; i < numImages - 1; i++) {
      const inputA = i === 0 ? `v${i}` : `vout${i}`;
      const inputB = `v${i + 1}`;
      const outputLabel = i === numImages - 2 ? `vfinal` : `vout${i + 1}`;
      
      filters.push(
        `[${inputA}][${inputB}]xfade=transition=fade:duration=${this.transitionDuration}:offset=${offset.toFixed(2)}[${outputLabel}]`
      );
      
      offset += this.displayDuration;
    }

    return {
      filterComplex: filters.join(';')
    };
  }

  private getExtension(file: File): string {
    const parts = file.name.split('.');
    return parts.pop()?.toLowerCase() ?? 'jpg';
  }
}
