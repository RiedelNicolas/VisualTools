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
    this.settingsEl = this.container.querySelector('#slideshow-settings');
    this.infoEl = this.container.querySelector('#slideshow-info');
    this.infoTextEl = this.container.querySelector('#info-text');
    this.displayDurationInput = this.container.querySelector('#display-duration');
    this.transitionDurationInput = this.container.querySelector('#transition-duration');
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

    // Listen for duration changes
    this.displayDurationInput.addEventListener('input', () => this.updateInfoText());
    this.transitionDurationInput.addEventListener('input', () => this.updateInfoText());

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
      this.settingsEl.classList.remove('hidden');
      this.infoEl.classList.remove('hidden');
    } else {
      this.clearBtn.classList.add('hidden');
      this.settingsEl.classList.add('hidden');
      this.infoEl.classList.add('hidden');
    }

    // Enable generate button if we have at least 2 files
    this.generateBtn.disabled = this.files.length < 2;
  }

  /**
   * Update the info text to reflect current duration settings
   */
  updateInfoText() {
    const displayDuration = parseFloat(this.displayDurationInput.value) || CONFIG.DISPLAY_DURATION;
    const transitionDuration = parseFloat(this.transitionDurationInput.value) || CONFIG.TRANSITION_DURATION;
    this.infoTextEl.textContent = `Drag images to reorder them. Each image shows for ${displayDuration}s with ${transitionDuration}s fade transitions.`;
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

    // Get duration values from inputs
    const displayDuration = parseFloat(this.displayDurationInput.value) || CONFIG.DISPLAY_DURATION;
    const transitionDuration = parseFloat(this.transitionDurationInput.value) || CONFIG.TRANSITION_DURATION;

    // Validate durations
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
      // Pass custom durations to processor
      this.processor.displayDuration = displayDuration;
      this.processor.transitionDuration = transitionDuration;
      
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
    this.components.downloadBtn.setResult(data);
    
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
    this.settingsEl.classList.add('hidden');
    this.infoEl.classList.add('hidden');
    // Reset duration inputs to default values
    this.displayDurationInput.value = CONFIG.DISPLAY_DURATION;
    this.transitionDurationInput.value = CONFIG.TRANSITION_DURATION;
    this.updateInfoText();
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
