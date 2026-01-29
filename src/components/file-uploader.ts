import { eventBus } from '../core/event-bus.ts';
import { validateFile } from '../utils/validation.ts';
import { readFileAsDataURL } from '../utils/file-handler.ts';
import { CONFIG } from '../config.ts';
import type { FileUploaderOptions } from '../types.ts';

export class FileUploader {
  private container: HTMLElement;
  private options: Required<FileUploaderOptions>;
  private files: File[];
  private uploadZone!: HTMLElement;
  private fileInput!: HTMLInputElement;
  private previewGrid!: HTMLElement;
  private errorEl!: HTMLElement;

  constructor(container: HTMLElement, options: FileUploaderOptions = {}) {
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

  private render(): void {
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

    const uploadZone = this.container.querySelector('.upload-zone');
    const fileInput = this.container.querySelector('.file-input');
    const previewGrid = this.container.querySelector('.file-preview-grid');
    const errorEl = this.container.querySelector('.upload-error');

    if (!uploadZone || !fileInput || !previewGrid || !errorEl) {
      throw new Error('Failed to initialize file uploader elements');
    }

    this.uploadZone = uploadZone as HTMLElement;
    this.fileInput = fileInput as HTMLInputElement;
    this.previewGrid = previewGrid as HTMLElement;
    this.errorEl = errorEl as HTMLElement;
  }

  private attachEvents(): void {
    this.uploadZone.addEventListener('click', () => this.fileInput.click());
    
    this.uploadZone.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.fileInput.click();
      }
    });

    this.fileInput.addEventListener('change', (e: Event) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        this.handleFiles(target.files);
      }
    });

    this.uploadZone.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      this.uploadZone.classList.add('drag-over');
    });

    this.uploadZone.addEventListener('dragleave', () => {
      this.uploadZone.classList.remove('drag-over');
    });

    this.uploadZone.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      this.uploadZone.classList.remove('drag-over');
      if (e.dataTransfer?.files) {
        this.handleFiles(e.dataTransfer.files);
      }
    });
  }

  private async handleFiles(fileList: FileList): Promise<void> {
    this.clearError();
    const newFiles = Array.from(fileList);

    for (const file of newFiles) {
      const result = validateFile(file);
      if (!result.valid) {
        this.showError(`${file.name}: ${result.error}`);
        return;
      }
    }

    const totalFiles = this.files.length + newFiles.length;
    if (totalFiles > this.options.maxFiles) {
      this.showError(`Maximum ${this.options.maxFiles} files allowed`);
      return;
    }

    this.files = [...this.files, ...newFiles];
    await this.updatePreview();
    this.emitChange();
  }

  private async updatePreview(): Promise<void> {
    this.previewGrid.innerHTML = '';

    for (let i = 0; i < this.files.length; i++) {
      const file = this.files[i];
      if (!file) continue;
      
      const dataUrl = await readFileAsDataURL(file);
      
      const preview = document.createElement('div');
      preview.className = 'file-preview-item';
      preview.draggable = true;
      preview.dataset['index'] = String(i);
      
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
      removeBtn.dataset['index'] = String(i);
      removeBtn.textContent = '×';
      
      preview.appendChild(img);
      preview.appendChild(fileName);
      preview.appendChild(removeBtn);

      removeBtn.addEventListener('click', (e: Event) => {
        e.stopPropagation();
        const target = e.target as HTMLElement;
        const index = target.dataset['index'];
        if (index !== undefined) {
          this.removeFile(parseInt(index));
        }
      });

      preview.addEventListener('dragstart', (e: DragEvent) => this.handleDragStart(e));
      preview.addEventListener('dragover', (e: DragEvent) => this.handleDragOver(e));
      preview.addEventListener('drop', (e: DragEvent) => this.handleDrop(e));
      preview.addEventListener('dragend', () => this.handleDragEnd());

      this.previewGrid.appendChild(preview);
    }
  }

  private handleDragStart(e: DragEvent): void {
    const target = e.target as HTMLElement;
    target.classList.add('dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', target.dataset['index'] || '');
    }
  }

  private handleDragOver(e: DragEvent): void {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'move';
    }
    
    const target = (e.target as HTMLElement).closest('.file-preview-item') as HTMLElement;
    if (target && !target.classList.contains('dragging')) {
      target.classList.add('drag-target');
    }
  }

  private handleDrop(e: DragEvent): void {
    e.preventDefault();
    const fromIndexStr = e.dataTransfer?.getData('text/plain');
    if (!fromIndexStr) return;
    
    const fromIndex = parseInt(fromIndexStr);
    const target = (e.target as HTMLElement).closest('.file-preview-item') as HTMLElement;
    
    if (target) {
      target.classList.remove('drag-target');
      const toIndex = parseInt(target.dataset['index'] || '0');
      
      if (fromIndex !== toIndex) {
        const [movedFile] = this.files.splice(fromIndex, 1);
        if (movedFile) {
          this.files.splice(toIndex, 0, movedFile);
          this.updatePreview();
          this.emitChange();
        }
      }
    }
  }

  private handleDragEnd(): void {
    this.previewGrid.querySelectorAll('.file-preview-item').forEach(item => {
      item.classList.remove('dragging', 'drag-target');
    });
  }

  private removeFile(index: number): void {
    this.files.splice(index, 1);
    this.updatePreview();
    this.emitChange();
  }

  private showError(message: string): void {
    this.errorEl.textContent = message;
    this.errorEl.classList.add('visible');
  }

  private clearError(): void {
    this.errorEl.textContent = '';
    this.errorEl.classList.remove('visible');
  }

  private emitChange(): void {
    eventBus.emit<File[]>(this.options.eventName, this.files);
  }

  getFiles(): File[] {
    return this.files;
  }

  clear(): void {
    this.files = [];
    this.previewGrid.innerHTML = '';
    this.fileInput.value = '';
    this.clearError();
    this.emitChange();
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
