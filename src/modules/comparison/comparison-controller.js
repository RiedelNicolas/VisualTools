import { eventBus } from '../../core/event-bus.js';
import { stateManager } from '../../core/state-manager.js';
import { FileUploader } from '../../components/file-uploader.js';
import { ProgressBar } from '../../components/progress-bar.js';
import { ImagePreview } from '../../components/image-preview.js';
import { DownloadButton } from '../../components/download-button.js';
import { ComparisonProcessor } from './comparison-processor.js';
import { validateComparisonFiles } from '../../utils/validation.js';

/**
 * Controller for the comparison tool
 */
export class ComparisonController {
  /**
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.container = container;
    this.processor = new ComparisonProcessor();
    this.files = [];
    this.unsubscribers = [];
    this.components = {};
    this.render();
    this.initComponents();
    this.attachEvents();
  }

  render() {
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

    // Cache DOM references
    this.generateBtn = this.container.querySelector('#comparison-generate');
    this.clearBtn = this.container.querySelector('#comparison-clear');
    this.resultSection = this.container.querySelector('#comparison-result');
    this.resultImg = this.container.querySelector('#comparison-result-img');
    this.errorEl = this.container.querySelector('#comparison-error');
  }

  initComponents() {
    // File uploader (limited to 2 files)
    this.components.uploader = new FileUploader(
      this.container.querySelector('#comparison-uploader'),
      {
        maxFiles: 2,
        multiple: true,
        eventName: 'comparison-files-changed'
      }
    );

    // Image preview
    this.components.preview = new ImagePreview(
      this.container.querySelector('#comparison-preview')
    );

    // Progress bar
    this.components.progressBar = new ProgressBar(
      this.container.querySelector('#comparison-progress')
    );

    // Download button
    this.components.downloadBtn = new DownloadButton(
      this.container.querySelector('#comparison-download'),
      {
        prefix: 'comparison',
        extension: '.png',
        mimeType: 'image/png'
      }
    );
  }

  attachEvents() {
    // Listen for file changes
    this.unsubscribers.push(
      eventBus.on('comparison-files-changed', (files) => {
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

  async onFilesChanged() {
    this.hideResult();
    this.hideError();

    if (this.files.length > 0) {
      this.clearBtn.classList.remove('hidden');
    } else {
      this.clearBtn.classList.add('hidden');
    }

    // Update preview
    if (this.files.length === 2) {
      await this.components.preview.showComparison(this.files);
      this.generateBtn.disabled = false;
    } else {
      this.components.preview.clear();
      this.generateBtn.disabled = true;
    }
  }

  async generate() {
    this.hideError();
    this.hideResult();

    // Validate files
    const validation = validateComparisonFiles(this.files);
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
      this.generateBtn.disabled = false;
    }
  }

  showResult(data) {
    const blob = new Blob([data], { type: 'image/png' });
    const url = URL.createObjectURL(blob);
    
    // Clean up previous URL
    if (this.resultImg.src && this.resultImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.resultImg.src);
    }
    
    this.resultImg.src = url;
    this.resultSection.classList.remove('hidden');
    this.components.downloadBtn.setResult(data);
    
    // Scroll to result
    this.resultSection.scrollIntoView({ behavior: 'smooth' });
  }

  hideResult() {
    this.resultSection.classList.add('hidden');
    this.components.downloadBtn.hide();
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
    this.components.preview.clear();
    this.hideResult();
    this.hideError();
    this.generateBtn.disabled = true;
    this.clearBtn.classList.add('hidden');
    stateManager.reset();
  }

  destroy() {
    // Clean up subscriptions
    this.unsubscribers.forEach(unsub => unsub());
    
    // Clean up components
    Object.values(this.components).forEach(comp => comp.destroy?.());
    
    // Clean up result URL
    if (this.resultImg.src && this.resultImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.resultImg.src);
    }
    
    this.container.innerHTML = '';
  }
}
