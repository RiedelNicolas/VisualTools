import { eventBus } from '../../core/event-bus.ts';
import { stateManager } from '../../core/state-manager.ts';
import { FileUploader } from '../../components/file-uploader.ts';
import { ProgressBar } from '../../components/progress-bar.ts';
import { ImagePreview } from '../../components/image-preview.ts';
import { DownloadButton } from '../../components/download-button.ts';
import { ImageGridProcessor } from './image-grid-processor.ts';
import { validateSlideshowFiles } from '../../utils/validation.ts';
import type { UnsubscribeFunction } from '../../types.ts';

interface Components {
  uploader: FileUploader;
  preview: ImagePreview;
  progressBar: ProgressBar;
  downloadBtn: DownloadButton;
}

export class ImageGridController {
  private container: HTMLElement;
  private processor: ImageGridProcessor;
  private files: File[];
  private unsubscribers: UnsubscribeFunction[];
  private components: Partial<Components>;
  private generateBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;
  private resultSection!: HTMLElement;
  private resultImg!: HTMLImageElement;
  private errorEl!: HTMLElement;
  private widthInput!: HTMLInputElement;
  private heightInput!: HTMLInputElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.processor = new ImageGridProcessor();
    this.files = [];
    this.unsubscribers = [];
    this.components = {};
    this.render();
    this.initComponents();
    this.attachEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="image-grid-tool">
        <div class="tool-header">
          <h2>Image Grid</h2>
          <p>Combine multiple images into a single grid layout</p>
        </div>
        
        <div class="tool-content">
          <div id="image-grid-uploader"></div>
          <div id="image-grid-preview"></div>
          
          <div class="grid-options">
            <h3>Grid Output Dimensions</h3>
            <div class="settings-grid">
              <div class="setting-item">
                <label for="grid-width">Width (px)</label>
                <input type="number" id="grid-width" class="duration-input" value="1920" min="100" max="7680" step="1">
                <span class="setting-hint">Output width in pixels</span>
              </div>
              <div class="setting-item">
                <label for="grid-height">Height (px)</label>
                <input type="number" id="grid-height" class="duration-input" value="1080" min="100" max="4320" step="1">
                <span class="setting-hint">Output height in pixels</span>
              </div>
            </div>
          </div>
          
          <div class="tool-actions">
            <button id="image-grid-generate" class="primary-btn" disabled>
              Generate Grid
            </button>
            <button id="image-grid-clear" class="secondary-btn hidden">
              Clear
            </button>
          </div>
          
          <div id="image-grid-progress"></div>
          
          <div id="image-grid-result" class="result-section hidden">
            <h3>Result</h3>
            <div class="result-image-container">
              <img id="image-grid-result-img" src="" alt="Image grid result">
            </div>
            <div id="image-grid-download"></div>
          </div>
          
          <div id="image-grid-error" class="error-message hidden"></div>
        </div>
      </div>
    `;

    const generateBtn = this.container.querySelector('#image-grid-generate');
    const clearBtn = this.container.querySelector('#image-grid-clear');
    const resultSection = this.container.querySelector('#image-grid-result');
    const resultImg = this.container.querySelector('#image-grid-result-img');
    const errorEl = this.container.querySelector('#image-grid-error');
    const widthInput = this.container.querySelector('#grid-width');
    const heightInput = this.container.querySelector('#grid-height');

    if (!generateBtn || !clearBtn || !resultSection || !resultImg || !errorEl || !widthInput || !heightInput) {
      throw new Error('Failed to initialize image grid controller elements');
    }

    this.generateBtn = generateBtn as HTMLButtonElement;
    this.clearBtn = clearBtn as HTMLButtonElement;
    this.resultSection = resultSection as HTMLElement;
    this.resultImg = resultImg as HTMLImageElement;
    this.errorEl = errorEl as HTMLElement;
    this.widthInput = widthInput as HTMLInputElement;
    this.heightInput = heightInput as HTMLInputElement;
  }

  private initComponents(): void {
    const uploaderContainer = this.container.querySelector('#image-grid-uploader');
    const previewContainer = this.container.querySelector('#image-grid-preview');
    const progressContainer = this.container.querySelector('#image-grid-progress');
    const downloadContainer = this.container.querySelector('#image-grid-download');

    if (!uploaderContainer || !previewContainer || !progressContainer || !downloadContainer) {
      throw new Error('Failed to find component containers');
    }

    this.components.uploader = new FileUploader(
      uploaderContainer as HTMLElement,
      {
        maxFiles: 20,
        multiple: true,
        eventName: 'image-grid-files-changed'
      }
    );

    this.components.preview = new ImagePreview(previewContainer as HTMLElement);
    this.components.progressBar = new ProgressBar(progressContainer as HTMLElement);
    this.components.downloadBtn = new DownloadButton(
      downloadContainer as HTMLElement,
      {
        prefix: 'image-grid',
        extension: '.png',
        mimeType: 'image/png'
      }
    );
  }

  private attachEvents(): void {
    this.unsubscribers.push(
      eventBus.on<File[]>('image-grid-files-changed', (files) => {
        this.files = files;
        this.onFilesChanged();
      })
    );

    this.generateBtn.addEventListener('click', () => this.generate());
    this.clearBtn.addEventListener('click', () => this.clear());

    this.unsubscribers.push(
      stateManager.subscribe('error', (error) => {
        if (error) {
          this.showError(error as string);
        }
      })
    );
  }

  private async onFilesChanged(): Promise<void> {
    this.hideResult();
    this.hideError();

    if (this.files.length > 0) {
      this.clearBtn.classList.remove('hidden');
    } else {
      this.clearBtn.classList.add('hidden');
    }

    if (this.files.length >= 1) {
      await this.components.preview?.update(this.files);
      this.generateBtn.disabled = false;
    } else {
      this.components.preview?.clear();
      this.generateBtn.disabled = true;
    }
  }

  private async generate(): Promise<void> {
    this.hideError();
    this.hideResult();

    // Validate files (reuse slideshow validation since it allows multiple images)
    const validation = validateSlideshowFiles(this.files);
    if (!validation.valid) {
      this.showError(validation.error ?? 'Validation failed');
      return;
    }

    // Get grid dimensions from inputs
    const width = parseInt(this.widthInput.value, 10);
    const height = parseInt(this.heightInput.value, 10);

    if (isNaN(width) || isNaN(height) || width < 100 || height < 100) {
      this.showError('Please enter valid dimensions (minimum 100px)');
      return;
    }

    this.generateBtn.disabled = true;

    try {
      const result = await this.processor.process(this.files, { width, height });
      this.showResult(result);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.generateBtn.disabled = false;
    }
  }

  private showResult(data: Uint8Array): void {
    const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    
    if (this.resultImg.src && this.resultImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.resultImg.src);
    }
    
    this.resultImg.src = url;
    this.resultSection.classList.remove('hidden');
    this.components.downloadBtn?.setResult(data);
    
    this.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  private hideResult(): void {
    this.resultSection.classList.add('hidden');
    this.components.downloadBtn?.hide();
  }

  private showError(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.classList.remove('hidden');
  }

  private hideError(): void {
    this.errorEl.textContent = '';
    this.errorEl.classList.add('hidden');
    stateManager.setState({ error: null });
  }

  clear(): void {
    this.files = [];
    this.components.uploader?.clear();
    this.components.preview?.clear();
    this.hideResult();
    this.hideError();
    this.generateBtn.disabled = true;
    this.clearBtn.classList.add('hidden');
    stateManager.reset();
  }

  destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    
    Object.values(this.components).forEach(comp => comp?.destroy?.());
    
    if (this.resultImg.src && this.resultImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.resultImg.src);
    }
    
    this.container.innerHTML = '';
  }
}
