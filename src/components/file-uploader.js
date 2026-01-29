import { eventBus } from '../core/event-bus.js';
import { validateFile } from '../utils/validation.js';
import { readFileAsDataURL } from '../utils/file-handler.js';
import { CONFIG } from '../config.js';

/**
 * File uploader component with drag-and-drop support
 */
export class FileUploader {
  /**
   * @param {HTMLElement} container - Container element
   * @param {Object} options - Configuration options
   * @param {number} [options.maxFiles=20] - Maximum number of files
   * @param {boolean} [options.multiple=true] - Allow multiple files
   * @param {string} [options.eventName='files-changed'] - Event name for file changes
   */
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      maxFiles: options.maxFiles ?? CONFIG.MAX_FILES_SLIDESHOW,
      multiple: options.multiple ?? true,
      eventName: options.eventName ?? 'files-changed'
    };
    this.files = [];
    this.render();
    this.attachEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="file-uploader">
        <div class="upload-zone" tabindex="0" role="button" aria-label="Upload images">
          <div class="upload-icon">📁</div>
          <p class="upload-text">Drag & drop images here</p>
          <p class="upload-subtext">or click to browse</p>
          <p class="upload-formats">Supports PNG, JPG (max ${this.options.maxFiles} files, 50MB each)</p>
          <input type="file" 
                 class="file-input" 
                 accept="${CONFIG.ACCEPTED_FORMATS.join(',')}"
                 ${this.options.multiple ? 'multiple' : ''}>
        </div>
        <div class="file-preview-grid"></div>
        <div class="upload-error"></div>
      </div>
    `;

    this.uploadZone = this.container.querySelector('.upload-zone');
    this.fileInput = this.container.querySelector('.file-input');
    this.previewGrid = this.container.querySelector('.file-preview-grid');
    this.errorEl = this.container.querySelector('.upload-error');
  }

  attachEvents() {
    // Click to upload
    this.uploadZone.addEventListener('click', () => this.fileInput.click());
    
    // Keyboard accessibility
    this.uploadZone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.fileInput.click();
      }
    });

    // File input change
    this.fileInput.addEventListener('change', (e) => this.handleFiles(e.target.files));

    // Drag and drop
    this.uploadZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.uploadZone.classList.add('drag-over');
    });

    this.uploadZone.addEventListener('dragleave', () => {
      this.uploadZone.classList.remove('drag-over');
    });

    this.uploadZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.uploadZone.classList.remove('drag-over');
      this.handleFiles(e.dataTransfer.files);
    });
  }

  async handleFiles(fileList) {
    this.clearError();
    const newFiles = Array.from(fileList);

    // Validate each file
    for (const file of newFiles) {
      const result = validateFile(file);
      if (!result.valid) {
        this.showError(`${file.name}: ${result.error}`);
        return;
      }
    }

    // Check max files limit
    const totalFiles = this.files.length + newFiles.length;
    if (totalFiles > this.options.maxFiles) {
      this.showError(`Maximum ${this.options.maxFiles} files allowed`);
      return;
    }

    // Add files
    this.files = [...this.files, ...newFiles];
    await this.updatePreview();
    this.emitChange();
  }

  async updatePreview() {
    this.previewGrid.innerHTML = '';

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      const dataUrl = await readFileAsDataURL(file);
      
      const preview = document.createElement('div');
      preview.className = 'file-preview-item';
      preview.draggable = true;
      preview.dataset.index = i;
      
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = file.name;
      img.draggable = false;
      
      const fileName = document.createElement('span');
      fileName.className = 'file-name';
      fileName.textContent = file.name;
      
      const removeBtn = document.createElement('button');
      removeBtn.className = 'remove-btn';
      removeBtn.setAttribute('aria-label', `Remove ${file.name}`);
      removeBtn.dataset.index = i;
      removeBtn.textContent = '×';
      
      preview.appendChild(img);
      preview.appendChild(fileName);
      preview.appendChild(removeBtn);

      // Remove button
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeFile(parseInt(e.target.dataset.index));
      });

      // Drag and drop reordering
      preview.addEventListener('dragstart', (e) => this.handleDragStart(e));
      preview.addEventListener('dragover', (e) => this.handleDragOver(e));
      preview.addEventListener('drop', (e) => this.handleDrop(e));
      preview.addEventListener('dragend', () => this.handleDragEnd());

      this.previewGrid.appendChild(preview);
    }
  }

  handleDragStart(e) {
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.index);
  }

  handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    const target = e.target.closest('.file-preview-item');
    if (target && !target.classList.contains('dragging')) {
      target.classList.add('drag-target');
    }
  }

  handleDrop(e) {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
    const target = e.target.closest('.file-preview-item');
    
    if (target) {
      target.classList.remove('drag-target');
      const toIndex = parseInt(target.dataset.index);
      
      if (fromIndex !== toIndex) {
        // Reorder files
        const [movedFile] = this.files.splice(fromIndex, 1);
        this.files.splice(toIndex, 0, movedFile);
        this.updatePreview();
        this.emitChange();
      }
    }
  }

  handleDragEnd() {
    this.previewGrid.querySelectorAll('.file-preview-item').forEach(item => {
      item.classList.remove('dragging', 'drag-target');
    });
  }

  removeFile(index) {
    this.files.splice(index, 1);
    this.updatePreview();
    this.emitChange();
  }

  showError(message) {
    this.errorEl.textContent = message;
    this.errorEl.classList.add('visible');
  }

  clearError() {
    this.errorEl.textContent = '';
    this.errorEl.classList.remove('visible');
  }

  emitChange() {
    eventBus.emit(this.options.eventName, this.files);
  }

  getFiles() {
    return this.files;
  }

  clear() {
    this.files = [];
    this.previewGrid.innerHTML = '';
    this.fileInput.value = '';
    this.clearError();
    this.emitChange();
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
