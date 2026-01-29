import { eventBus } from '../../core/event-bus.ts';
import { stateManager } from '../../core/state-manager.ts';
import { FileUploader } from '../../components/file-uploader.ts';
import { ProgressBar } from '../../components/progress-bar.ts';
import { ImagePreview } from '../../components/image-preview.ts';
import { DownloadButton } from '../../components/download-button.ts';
import { ComparisonProcessor } from './comparison-processor.ts';
import { validateComparisonFiles } from '../../utils/validation.ts';
import type { UnsubscribeFunction } from '../../types.ts';

interface Components {
  uploader: FileUploader;
  preview: ImagePreview;
  progressBar: ProgressBar;
  downloadBtn: DownloadButton;
}

export class ComparisonController {
  private container: HTMLElement;
  private processor: ComparisonProcessor;
  private files: File[];
  private unsubscribers: UnsubscribeFunction[];
  private components: Partial<Components>;
  private generateBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;
  private resultSection!: HTMLElement;
  private resultImg!: HTMLImageElement;
  private errorEl!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.processor = new ComparisonProcessor();
    this.files = [];
    this.unsubscribers = [];
    this.components = {};
    this.render();
    this.initComponents();
    this.attachEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="comparison-tool">
        <div class="tool-header">
          <h2>Side-by-Side Comparison</h2>
          <p>Combine two images horizontally for easy comparison</p>
        </div>
        
        <div class="tool-content">
          <div id="comparison-uploader"></div>
          <div id="comparison-preview"></div>
          
          <div class="tool-actions">
            <button id="comparison-generate" class="primary-btn" disabled>
              Generate Comparison
            </button>
            <button id="comparison-clear" class="secondary-btn hidden">
              Clear
            </button>
          </div>
          
          <div id="comparison-progress"></div>
          
          <div id="comparison-result" class="result-section hidden">
            <h3>Result</h3>
            <div class="result-image-container">
              <img id="comparison-result-img" src="" alt="Comparison result">
            </div>
            <div id="comparison-download"></div>
          </div>
          
          <div id="comparison-error" class="error-message hidden"></div>
        </div>
      </div>
    `;

    const generateBtn = this.container.querySelector('#comparison-generate');
    const clearBtn = this.container.querySelector('#comparison-clear');
    const resultSection = this.container.querySelector('#comparison-result');
    const resultImg = this.container.querySelector('#comparison-result-img');
    const errorEl = this.container.querySelector('#comparison-error');

    if (!generateBtn || !clearBtn || !resultSection || !resultImg || !errorEl) {
      throw new Error('Failed to initialize comparison controller elements');
    }

    this.generateBtn = generateBtn as HTMLButtonElement;
    this.clearBtn = clearBtn as HTMLButtonElement;
    this.resultSection = resultSection as HTMLElement;
    this.resultImg = resultImg as HTMLImageElement;
    this.errorEl = errorEl as HTMLElement;
  }

  private initComponents(): void {
    const uploaderContainer = this.container.querySelector('#comparison-uploader');
    const previewContainer = this.container.querySelector('#comparison-preview');
    const progressContainer = this.container.querySelector('#comparison-progress');
    const downloadContainer = this.container.querySelector('#comparison-download');

    if (!uploaderContainer || !previewContainer || !progressContainer || !downloadContainer) {
      throw new Error('Failed to find component containers');
    }

    this.components.uploader = new FileUploader(
      uploaderContainer as HTMLElement,
      {
        maxFiles: 2,
        multiple: true,
        eventName: 'comparison-files-changed'
      }
    );

    this.components.preview = new ImagePreview(previewContainer as HTMLElement);
    this.components.progressBar = new ProgressBar(progressContainer as HTMLElement);
    this.components.downloadBtn = new DownloadButton(
      downloadContainer as HTMLElement,
      {
        prefix: 'comparison',
        extension: '.png',
        mimeType: 'image/png'
      }
    );
  }

  private attachEvents(): void {
    this.unsubscribers.push(
      eventBus.on<File[]>('comparison-files-changed', (files) => {
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

    if (this.files.length === 2) {
      await this.components.preview?.showComparison(this.files);
      this.generateBtn.disabled = false;
    } else {
      this.components.preview?.clear();
      this.generateBtn.disabled = true;
    }
  }

  private async generate(): Promise<void> {
    this.hideError();
    this.hideResult();

    const validation = validateComparisonFiles(this.files);
    if (!validation.valid) {
      this.showError(validation.error ?? 'Validation failed');
      return;
    }

    this.generateBtn.disabled = true;

    try {
      const result = await this.processor.process(this.files);
      this.showResult(result);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.generateBtn.disabled = false;
    }
  }

  private showResult(data: Uint8Array): void {
    // Create a new Uint8Array from an ArrayBuffer to ensure type compatibility
    const safeData = new Uint8Array(data);
    const blob = new Blob([safeData], { type: 'image/png' });
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
