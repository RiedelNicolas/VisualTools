import { eventBus } from '../../core/event-bus.js';
import { stateManager } from '../../core/state-manager.js';
import { FileUploader } from '../../components/file-uploader.js';
import { ProgressBar } from '../../components/progress-bar.js';
import { DownloadButton } from '../../components/download-button.js';
import { SlideshowProcessor } from './slideshow-processor.js';
import { validateSlideshowFiles } from '../../utils/validation.js';
import { CONFIG } from '../../config.js';

/**
 * Controller for the slideshow tool
 */
export class SlideshowController {
  /**
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
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

  render() {
    this.container.innerHTML = `
      <div class="slideshow-tool">
        <div class="tool-header">
          <h2>Slideshow Generator</h2>
          <p>Create an MP4 video with crossfade transitions from your images</p>
        </div>
        
        <div class="tool-content">
          <div id="slideshow-uploader"></div>
          
          <div class="slideshow-info hidden" id="slideshow-info">
            <span class="info-icon">ℹ️</span>
            <span class="info-text">Drag images to reorder them. Each image shows for ${CONFIG.DISPLAY_DURATION}s with ${CONFIG.TRANSITION_DURATION}s fade transitions.</span>
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

    // Cache DOM references
    this.generateBtn = this.container.querySelector('#slideshow-generate');
    this.clearBtn = this.container.querySelector('#slideshow-clear');
    this.infoEl = this.container.querySelector('#slideshow-info');
    this.resultSection = this.container.querySelector('#slideshow-result');
    this.videoEl = this.container.querySelector('#slideshow-video');
    this.errorEl = this.container.querySelector('#slideshow-error');
  }

  initComponents() {
    // File uploader
    this.components.uploader = new FileUploader(
      this.container.querySelector('#slideshow-uploader'),
      {
        maxFiles: CONFIG.MAX_FILES_SLIDESHOW,
        multiple: true,
        eventName: 'slideshow-files-changed'
      }
    );

    // Progress bar
    this.components.progressBar = new ProgressBar(
      this.container.querySelector('#slideshow-progress')
    );

    // Download button
    this.components.downloadBtn = new DownloadButton(
      this.container.querySelector('#slideshow-download'),
      {
        prefix: 'slideshow',
        extension: '.mp4',
        mimeType: 'video/mp4'
      }
    );
  }

  attachEvents() {
    // Listen for file changes
    this.unsubscribers.push(
      eventBus.on('slideshow-files-changed', (files) => {
        this.files = files;
        this.onFilesChanged();
      })
    );

    // Generate button
    this.generateBtn.addEventListener('click', () => this.generate());

    // Clear button
    this.clearBtn.addEventListener('click', () => this.clear());

    // Subscribe to error state
    this.unsubscribers.push(
      stateManager.subscribe('error', (error) => {
        if (error) {
          this.showError(error);
        }
      })
    );
  }

  onFilesChanged() {
    this.hideResult();
    this.hideError();

    if (this.files.length > 0) {
      this.clearBtn.classList.remove('hidden');
      this.infoEl.classList.remove('hidden');
    } else {
      this.clearBtn.classList.add('hidden');
      this.infoEl.classList.add('hidden');
    }

    // Enable generate button if we have at least 2 files
    this.generateBtn.disabled = this.files.length < 2;
  }

  async generate() {
    this.hideError();
    this.hideResult();

    // Validate files
    const validation = validateSlideshowFiles(this.files);
    if (!validation.valid) {
      this.showError(validation.error);
      return;
    }

    this.generateBtn.disabled = true;

    try {
      const result = await this.processor.process(this.files);
      this.showResult(result);
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.generateBtn.disabled = this.files.length < 2;
    }
  }

  showResult(data) {
    // Clean up previous URL
    this.cleanupVideoUrl();
    
    const blob = new Blob([data], { type: 'video/mp4' });
    this.videoObjectUrl = URL.createObjectURL(blob);
    
    this.videoEl.src = this.videoObjectUrl;
    this.resultSection.classList.remove('hidden');
    this.components.downloadBtn.setResult(data, {
      prefix: 'slideshow',
      extension: '.mp4',
      mimeType: 'video/mp4'
    });
    
    // Scroll to result
    this.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  hideResult() {
    this.resultSection.classList.add('hidden');
    this.components.downloadBtn.hide();
    this.cleanupVideoUrl();
  }

  cleanupVideoUrl() {
    if (this.videoObjectUrl) {
      URL.revokeObjectURL(this.videoObjectUrl);
      this.videoObjectUrl = null;
    }
    this.videoEl.src = '';
  }

  showError(message) {
    this.errorEl.textContent = message;
    this.errorEl.classList.remove('hidden');
  }

  hideError() {
    this.errorEl.textContent = '';
    this.errorEl.classList.add('hidden');
    stateManager.setState({ error: null });
  }

  clear() {
    this.files = [];
    this.components.uploader.clear();
    this.hideResult();
    this.hideError();
    this.generateBtn.disabled = true;
    this.clearBtn.classList.add('hidden');
    this.infoEl.classList.add('hidden');
    stateManager.reset();
  }

  destroy() {
    // Clean up subscriptions
    this.unsubscribers.forEach(unsub => unsub());
    
    // Clean up components
    Object.values(this.components).forEach(comp => comp.destroy?.());
    
    // Clean up video URL
    this.cleanupVideoUrl();
    
    this.container.innerHTML = '';
  }
}
