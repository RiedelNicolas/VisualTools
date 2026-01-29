import { eventBus } from '../../core/event-bus.ts';
import { stateManager } from '../../core/state-manager.ts';
import { FileUploader } from '../../components/file-uploader.ts';
import { ProgressBar } from '../../components/progress-bar.ts';
import { DownloadButton } from '../../components/download-button.ts';
import { SlideshowProcessor } from './slideshow-processor.ts';
import { validateSlideshowFiles } from '../../utils/validation.ts';
import { CONFIG } from '../../config.ts';
import type { UnsubscribeFunction } from '../../types.ts';

interface Components {
  uploader: FileUploader;
  progressBar: ProgressBar;
  downloadBtn: DownloadButton;
}

export class SlideshowController {
  private container: HTMLElement;
  private processor: SlideshowProcessor;
  private files: File[];
  private unsubscribers: UnsubscribeFunction[];
  private components: Partial<Components>;
  private videoObjectUrl: string | null;
  private generateBtn!: HTMLButtonElement;
  private clearBtn!: HTMLButtonElement;
  private settingsEl!: HTMLElement;
  private infoEl!: HTMLElement;
  private infoTextEl!: HTMLElement;
  private displayDurationInput!: HTMLInputElement;
  private transitionDurationInput!: HTMLInputElement;
  private resultSection!: HTMLElement;
  private videoEl!: HTMLVideoElement;
  private errorEl!: HTMLElement;
  private processingSpinner!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.processor = new SlideshowProcessor();
    this.files = [];
    this.unsubscribers = [];
    this.components = {};
    this.videoObjectUrl = null;
    this.render();
    this.initComponents();
    this.attachEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="slideshow-tool">
        <div class="tool-header">
          <h2>Slideshow Generator</h2>
          <p>Create an MP4 video with crossfade transitions from your images</p>
        </div>
        
        <div class="tool-content">
          <div id="slideshow-uploader"></div>
          
          <div class="slideshow-settings hidden" id="slideshow-settings">
            <h3>Video Settings</h3>
            <div class="settings-grid">
              <div class="setting-item">
                <label for="display-duration">Display Time (seconds)</label>
                <input 
                  type="number" 
                  id="display-duration" 
                  min="${CONFIG.DISPLAY_DURATION_MIN}" 
                  max="${CONFIG.DISPLAY_DURATION_MAX}" 
                  step="${CONFIG.DISPLAY_DURATION_STEP}" 
                  value="${CONFIG.DISPLAY_DURATION}"
                  class="duration-input"
                />
                <span class="setting-hint">How long each image is shown</span>
              </div>
              <div class="setting-item">
                <label for="transition-duration">Fade Time (seconds)</label>
                <input 
                  type="number" 
                  id="transition-duration" 
                  min="${CONFIG.TRANSITION_DURATION_MIN}" 
                  max="${CONFIG.TRANSITION_DURATION_MAX}" 
                  step="${CONFIG.TRANSITION_DURATION_STEP}" 
                  value="${CONFIG.TRANSITION_DURATION}"
                  class="duration-input"
                />
                <span class="setting-hint">Duration of crossfade transitions</span>
              </div>
            </div>
          </div>
          
          <div class="slideshow-info hidden" id="slideshow-info">
            <span class="info-icon">ℹ️</span>
            <span class="info-text" id="info-text">Drag images to reorder them. Each image shows for ${CONFIG.DISPLAY_DURATION}s with ${CONFIG.TRANSITION_DURATION}s fade transitions.</span>
          </div>
          
          <div class="tool-actions">
            <button id="slideshow-generate" class="primary-btn" disabled>
              Generate Video
            </button>
            <button id="slideshow-clear" class="secondary-btn hidden">
              Clear
            </button>
          </div>
          
          <div id="slideshow-progress"></div>
          
          <div id="slideshow-processing-spinner" class="processing-spinner-container hidden">
            <div class="spinner"></div>
            <p class="processing-message">Finalizing video...</p>
          </div>
          
          <div id="slideshow-result" class="result-section hidden">
            <h3>Result</h3>
            <div class="video-container">
              <video id="slideshow-video" controls playsinline></video>
            </div>
            <div id="slideshow-download"></div>
          </div>
          
          <div id="slideshow-error" class="error-message hidden"></div>
        </div>
      </div>
    `;

    const generateBtn = this.container.querySelector('#slideshow-generate');
    const clearBtn = this.container.querySelector('#slideshow-clear');
    const settingsEl = this.container.querySelector('#slideshow-settings');
    const infoEl = this.container.querySelector('#slideshow-info');
    const infoTextEl = this.container.querySelector('#info-text');
    const displayDurationInput = this.container.querySelector('#display-duration');
    const transitionDurationInput = this.container.querySelector('#transition-duration');
    const resultSection = this.container.querySelector('#slideshow-result');
    const videoEl = this.container.querySelector('#slideshow-video');
    const errorEl = this.container.querySelector('#slideshow-error');
    const processingSpinner = this.container.querySelector('#slideshow-processing-spinner');

    if (!generateBtn || !clearBtn || !settingsEl || !infoEl || !infoTextEl ||
        !displayDurationInput || !transitionDurationInput || !resultSection ||
        !videoEl || !errorEl || !processingSpinner) {
      throw new Error('Failed to initialize slideshow controller elements');
    }

    this.generateBtn = generateBtn as HTMLButtonElement;
    this.clearBtn = clearBtn as HTMLButtonElement;
    this.settingsEl = settingsEl as HTMLElement;
    this.infoEl = infoEl as HTMLElement;
    this.infoTextEl = infoTextEl as HTMLElement;
    this.displayDurationInput = displayDurationInput as HTMLInputElement;
    this.transitionDurationInput = transitionDurationInput as HTMLInputElement;
    this.resultSection = resultSection as HTMLElement;
    this.videoEl = videoEl as HTMLVideoElement;
    this.errorEl = errorEl as HTMLElement;
    this.processingSpinner = processingSpinner as HTMLElement;
  }

  private initComponents(): void {
    const uploaderContainer = this.container.querySelector('#slideshow-uploader');
    const progressContainer = this.container.querySelector('#slideshow-progress');
    const downloadContainer = this.container.querySelector('#slideshow-download');

    if (!uploaderContainer || !progressContainer || !downloadContainer) {
      throw new Error('Failed to find component containers');
    }

    this.components.uploader = new FileUploader(
      uploaderContainer as HTMLElement,
      {
        maxFiles: CONFIG.MAX_FILES_SLIDESHOW,
        multiple: true,
        eventName: 'slideshow-files-changed'
      }
    );

    this.components.progressBar = new ProgressBar(progressContainer as HTMLElement);
    this.components.downloadBtn = new DownloadButton(
      downloadContainer as HTMLElement,
      {
        prefix: 'slideshow',
        extension: '.mp4',
        mimeType: 'video/mp4'
      }
    );
  }

  private attachEvents(): void {
    this.unsubscribers.push(
      eventBus.on<File[]>('slideshow-files-changed', (files) => {
        this.files = files;
        this.onFilesChanged();
      })
    );

    this.generateBtn.addEventListener('click', () => this.generate());
    this.clearBtn.addEventListener('click', () => this.clear());

    this.displayDurationInput.addEventListener('input', () => this.updateInfoText());
    this.transitionDurationInput.addEventListener('input', () => this.updateInfoText());

    this.unsubscribers.push(
      stateManager.subscribe('error', (error) => {
        if (error) {
          this.showError(error as string);
        }
      })
    );

    // Subscribe to progress changes to show spinner when reaching 100%
    this.unsubscribers.push(
      stateManager.subscribe('progress', (progress) => {
        if (progress === 100 && stateManager.getState('processing')) {
          // Hide progress bar and show spinner when progress reaches 100%
          this.showProcessingSpinner();
        }
      })
    );
  }

  private onFilesChanged(): void {
    this.hideResult();
    this.hideError();
    this.hideProcessingSpinner();

    if (this.files.length > 0) {
      this.clearBtn.classList.remove('hidden');
      this.settingsEl.classList.remove('hidden');
      this.infoEl.classList.remove('hidden');
    } else {
      this.clearBtn.classList.add('hidden');
      this.settingsEl.classList.add('hidden');
      this.infoEl.classList.add('hidden');
    }

    this.generateBtn.disabled = this.files.length < 2;
  }

  private updateInfoText(): void {
    const displayDuration = parseFloat(this.displayDurationInput.value) || CONFIG.DISPLAY_DURATION;
    const transitionDuration = parseFloat(this.transitionDurationInput.value) || CONFIG.TRANSITION_DURATION;
    this.infoTextEl.textContent = `Drag images to reorder them. Each image shows for ${displayDuration}s with ${transitionDuration}s fade transitions.`;
  }

  private async generate(): Promise<void> {
    this.hideError();
    this.hideResult();
    this.hideProcessingSpinner();

    const validation = validateSlideshowFiles(this.files);
    if (!validation.valid) {
      this.showError(validation.error ?? 'Validation failed');
      return;
    }

    const displayDuration = parseFloat(this.displayDurationInput.value) || CONFIG.DISPLAY_DURATION;
    const transitionDuration = parseFloat(this.transitionDurationInput.value) || CONFIG.TRANSITION_DURATION;

    if (displayDuration < CONFIG.DISPLAY_DURATION_MIN || displayDuration > CONFIG.DISPLAY_DURATION_MAX) {
      this.showError(`Display time must be between ${CONFIG.DISPLAY_DURATION_MIN} and ${CONFIG.DISPLAY_DURATION_MAX} seconds`);
      return;
    }
    if (transitionDuration < CONFIG.TRANSITION_DURATION_MIN || transitionDuration > CONFIG.TRANSITION_DURATION_MAX) {
      this.showError(`Fade time must be between ${CONFIG.TRANSITION_DURATION_MIN} and ${CONFIG.TRANSITION_DURATION_MAX} seconds`);
      return;
    }

    this.generateBtn.disabled = true;

    try {
      this.processor.displayDuration = displayDuration;
      this.processor.transitionDuration = transitionDuration;
      
      const result = await this.processor.process(this.files);
      this.showResult(result);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      this.generateBtn.disabled = this.files.length < 2;
    }
  }

  private showResult(data: Uint8Array): void {
    this.hideProcessingSpinner();
    this.cleanupVideoUrl();
    
    // Note: TypeScript requires this because Uint8Array.buffer could be SharedArrayBuffer,
    // but Blob constructor only accepts ArrayBuffer. Creating a new Uint8Array ensures compatibility.
    const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
    this.videoObjectUrl = URL.createObjectURL(blob);
    
    this.videoEl.src = this.videoObjectUrl;
    this.resultSection.classList.remove('hidden');
    this.components.downloadBtn?.setResult(data);
    
    this.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  private hideResult(): void {
    this.resultSection.classList.add('hidden');
    this.components.downloadBtn?.hide();
    this.cleanupVideoUrl();
  }

  private cleanupVideoUrl(): void {
    if (this.videoObjectUrl) {
      URL.revokeObjectURL(this.videoObjectUrl);
      this.videoObjectUrl = null;
    }
    this.videoEl.src = '';
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

  private showProcessingSpinner(): void {
    this.processingSpinner.classList.remove('hidden');
  }

  private hideProcessingSpinner(): void {
    this.processingSpinner.classList.add('hidden');
  }

  clear(): void {
    this.files = [];
    this.components.uploader?.clear();
    this.hideResult();
    this.hideError();
    this.hideProcessingSpinner();
    this.generateBtn.disabled = true;
    this.clearBtn.classList.add('hidden');
    this.settingsEl.classList.add('hidden');
    this.infoEl.classList.add('hidden');
    this.displayDurationInput.value = String(CONFIG.DISPLAY_DURATION);
    this.transitionDurationInput.value = String(CONFIG.TRANSITION_DURATION);
    this.updateInfoText();
    stateManager.reset();
  }

  destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    
    Object.values(this.components).forEach(comp => comp?.destroy?.());
    
    this.cleanupVideoUrl();
    
    this.container.innerHTML = '';
  }
}
