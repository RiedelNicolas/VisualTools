import { downloadBlob, generateFilename } from '../utils/file-handler.js';

/**
 * Download button component for downloading processed results
 */
export class DownloadButton {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration options
   * @param {string} [options.prefix='output'] - Filename prefix
   * @param {string} [options.extension='.png'] - File extension
   * @param {string} [options.mimeType='image/png'] - MIME type
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      prefix: options.prefix ?? 'output',
      extension: options.extension ?? '.png',
      mimeType: options.mimeType ?? 'image/png'
    };
    this.blob = null;
    this.objectUrl = null;
    this.render();
    this.attachEvents();
  }

  render() {
    this.container.innerHTML = `
      <button class="download-btn primary-btn hidden" disabled>
        <span class="btn-icon">⬇️</span>
        <span class="btn-text">Download</span>
      </button>
    `;

    this.button = this.container.querySelector('.download-btn');
  }

  attachEvents() {
    this.button.addEventListener('click', () => this.download());
  }

  /**
   * Set the result data
   * @param {Blob|Uint8Array} data - Result data
   * @param {Object} [customOptions] - Override options
   */
  setResult(data, customOptions = {}) {
    // Clean up previous URL
    this.cleanup();

    const options = { ...this.options, ...customOptions };

    // Convert Uint8Array to Blob if needed
    if (data instanceof Uint8Array) {
      this.blob = new Blob([data], { type: options.mimeType });
    } else {
      this.blob = data;
    }

    this.objectUrl = URL.createObjectURL(this.blob);
    this.button.disabled = false;
    this.button.classList.remove('hidden');
  }

  download() {
    if (!this.blob) return;

    const filename = generateFilename(this.options.prefix, this.options.extension);
    downloadBlob(this.blob, filename);
  }

  cleanup() {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.blob = null;
  }

  hide() {
    this.button.classList.add('hidden');
    this.button.disabled = true;
    this.cleanup();
  }

  show() {
    if (this.blob) {
      this.button.classList.remove('hidden');
      this.button.disabled = false;
    }
  }

  destroy() {
    this.cleanup();
    this.container.innerHTML = '';
  }
}
