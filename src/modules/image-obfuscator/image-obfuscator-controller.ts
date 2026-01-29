import { eventBus } from '../../core/event-bus.ts';
import { stateManager } from '../../core/state-manager.ts';
import { FileUploader } from '../../components/file-uploader.ts';
import { DownloadButton } from '../../components/download-button.ts';
import { ImageObfuscatorProcessor, type RedactionRegion, type RedactionEffect } from './image-obfuscator-processor.ts';
import type { UnsubscribeFunction } from '../../types.ts';

interface Components {
  uploader: FileUploader;
  downloadBtn: DownloadButton;
}

export class ImageObfuscatorController {
  private container: HTMLElement;
  private processor: ImageObfuscatorProcessor;
  private file: File | null;
  private unsubscribers: UnsubscribeFunction[];
  private components: Partial<Components>;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private canvasContainer!: HTMLElement;
  private effectSelector!: HTMLSelectElement;
  private clearBtn!: HTMLButtonElement;
  private undoBtn!: HTMLButtonElement;
  private processBtn!: HTMLButtonElement;
  private resultSection!: HTMLElement;
  private resultImg!: HTMLImageElement;
  private errorEl!: HTMLElement;

  // Drawing state
  private regions: RedactionRegion[] = [];
  private isDrawing = false;
  private startX = 0;
  private startY = 0;
  private currentRect: RedactionRegion | null = null;
  private imageLoaded = false;
  private loadedImage: HTMLImageElement | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    this.processor = new ImageObfuscatorProcessor();
    this.file = null;
    this.unsubscribers = [];
    this.components = {};
    this.render();
    this.initComponents();
    this.attachEvents();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="image-obfuscator-tool">
        <div class="tool-header">
          <h2>Image Obfuscator</h2>
          <p>Blur or pixelate sensitive information in your images</p>
        </div>
        
        <div class="tool-content">
          <div id="redactor-uploader"></div>
          
          <div id="redactor-canvas-container" class="canvas-container hidden">
            <div class="canvas-controls">
              <div class="control-group">
                <label for="effect-selector">Effect:</label>
                <select id="effect-selector" class="effect-selector">
                  <option value="blur">Blur</option>
                  <option value="pixelate">Pixelate</option>
                </select>
              </div>
              <div class="control-buttons">
                <button id="redactor-undo" class="secondary-btn" disabled>
                  Undo Last
                </button>
                <button id="redactor-clear-regions" class="secondary-btn" disabled>
                  Clear All
                </button>
              </div>
            </div>
            
            <div id="redactor-instructions" class="instructions">
              <span class="instructions-icon">✏️</span>
              <span>Click and drag to select areas to redact</span>
            </div>
            
            <div class="canvas-wrapper">
              <canvas id="redactor-canvas"></canvas>
            </div>
          </div>
          
          <div class="tool-actions">
            <button id="redactor-process" class="primary-btn hidden" disabled>
              Apply Redaction
            </button>
          </div>
          
          <div id="redactor-result" class="result-section hidden">
            <h3>Redacted Image</h3>
            <div class="result-image-container">
              <img id="redactor-result-img" src="" alt="Redacted result">
            </div>
            <div id="redactor-download"></div>
          </div>
          
          <div id="redactor-error" class="error-message hidden"></div>
        </div>
      </div>
    `;

    const canvas = this.container.querySelector('#redactor-canvas');
    const canvasContainer = this.container.querySelector('#redactor-canvas-container');
    const effectSelector = this.container.querySelector('#effect-selector');
    const clearBtn = this.container.querySelector('#redactor-clear-regions');
    const undoBtn = this.container.querySelector('#redactor-undo');
    const processBtn = this.container.querySelector('#redactor-process');
    const resultSection = this.container.querySelector('#redactor-result');
    const resultImg = this.container.querySelector('#redactor-result-img');
    const errorEl = this.container.querySelector('#redactor-error');

    if (!canvas || !canvasContainer || !effectSelector || !clearBtn || !undoBtn || 
        !processBtn || !resultSection || !resultImg || !errorEl) {
      throw new Error('Failed to initialize image obfuscator controller elements');
    }

    this.canvas = canvas as HTMLCanvasElement;
    this.canvasContainer = canvasContainer as HTMLElement;
    this.effectSelector = effectSelector as HTMLSelectElement;
    this.clearBtn = clearBtn as HTMLButtonElement;
    this.undoBtn = undoBtn as HTMLButtonElement;
    this.processBtn = processBtn as HTMLButtonElement;
    this.resultSection = resultSection as HTMLElement;
    this.resultImg = resultImg as HTMLImageElement;
    this.errorEl = errorEl as HTMLElement;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    this.ctx = ctx;
  }

  private initComponents(): void {
    const uploaderContainer = this.container.querySelector('#redactor-uploader');
    const downloadContainer = this.container.querySelector('#redactor-download');

    if (!uploaderContainer || !downloadContainer) {
      throw new Error('Failed to find component containers');
    }

    this.components.uploader = new FileUploader(
      uploaderContainer as HTMLElement,
      {
        maxFiles: 1,
        multiple: false,
        eventName: 'redactor-file-changed'
      }
    );

    this.components.downloadBtn = new DownloadButton(
      downloadContainer as HTMLElement,
      {
        prefix: 'redacted',
        extension: '.png',
        mimeType: 'image/png'
      }
    );
  }

  private attachEvents(): void {
    this.unsubscribers.push(
      eventBus.on<File[]>('redactor-file-changed', (files) => {
        if (files.length > 0 && files[0]) {
          this.file = files[0];
          this.onFileChanged();
        }
      })
    );

    // Canvas drawing events
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.canvas.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('mouseleave', () => this.onMouseUp());

    // Button events
    this.clearBtn.addEventListener('click', () => this.clearRegions());
    this.undoBtn.addEventListener('click', () => this.undoLastRegion());
    this.processBtn.addEventListener('click', () => this.processImage());

    this.unsubscribers.push(
      stateManager.subscribe('error', (error) => {
        if (error) {
          this.showError(error as string);
        }
      })
    );
  }

  private async onFileChanged(): Promise<void> {
    this.hideResult();
    this.hideError();
    this.regions = [];
    this.imageLoaded = false;

    if (!this.file) {
      return;
    }

    try {
      await this.loadImageToCanvas(this.file);
      this.canvasContainer.classList.remove('hidden');
      this.processBtn.classList.remove('hidden');
      this.updateButtons();
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Failed to load image');
    }
  }

  private async loadImageToCanvas(file: File): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        // Set canvas size to match image
        const maxWidth = 800;
        const maxHeight = 600;
        let width = img.width;
        let height = img.height;

        // Scale down if too large
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        this.canvas.width = width;
        this.canvas.height = height;

        // Draw the image
        this.ctx.drawImage(img, 0, 0, width, height);
        
        this.loadedImage = img;
        this.imageLoaded = true;
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  private onMouseDown(e: MouseEvent): void {
    if (!this.imageLoaded) return;

    const rect = this.canvas.getBoundingClientRect();
    this.startX = e.clientX - rect.left;
    this.startY = e.clientY - rect.top;
    this.isDrawing = true;
  }

  private onMouseMove(e: MouseEvent): void {
    if (!this.isDrawing || !this.imageLoaded) return;

    const rect = this.canvas.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    // Calculate rectangle
    const x = Math.min(this.startX, currentX);
    const y = Math.min(this.startY, currentY);
    const width = Math.abs(currentX - this.startX);
    const height = Math.abs(currentY - this.startY);

    this.currentRect = { x, y, width, height };

    // Redraw
    this.redrawCanvas();
  }

  private onMouseUp(): void {
    if (!this.isDrawing) return;

    this.isDrawing = false;

    // Add the current rectangle to regions if it has size
    if (this.currentRect && this.currentRect.width > 5 && this.currentRect.height > 5) {
      this.regions.push(this.currentRect);
      this.currentRect = null;
      this.redrawCanvas();
      this.updateButtons();
    } else {
      this.currentRect = null;
      this.redrawCanvas();
    }
  }

  private redrawCanvas(): void {
    if (!this.imageLoaded || !this.loadedImage) return;

    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Redraw image
    this.ctx.drawImage(this.loadedImage, 0, 0, this.canvas.width, this.canvas.height);

    // Draw saved regions
    this.ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';

    for (const region of this.regions) {
      this.ctx.fillRect(region.x, region.y, region.width, region.height);
      this.ctx.strokeRect(region.x, region.y, region.width, region.height);
    }

    // Draw current rectangle being drawn
    if (this.currentRect) {
      this.ctx.fillRect(this.currentRect.x, this.currentRect.y, this.currentRect.width, this.currentRect.height);
      this.ctx.strokeRect(this.currentRect.x, this.currentRect.y, this.currentRect.width, this.currentRect.height);
    }
  }

  private clearRegions(): void {
    this.regions = [];
    this.currentRect = null;
    this.redrawCanvas();
    this.updateButtons();
  }

  private undoLastRegion(): void {
    if (this.regions.length > 0) {
      this.regions.pop();
      this.redrawCanvas();
      this.updateButtons();
    }
  }

  private updateButtons(): void {
    const hasRegions = this.regions.length > 0;
    this.clearBtn.disabled = !hasRegions;
    this.undoBtn.disabled = !hasRegions;
    this.processBtn.disabled = !hasRegions;
  }

  private async processImage(): Promise<void> {
    if (!this.file || this.regions.length === 0) {
      return;
    }

    this.hideError();
    this.hideResult();
    this.processBtn.disabled = true;

    try {
      const effect = this.effectSelector.value as RedactionEffect;
      
      // Scale regions back to original image size if canvas was scaled
      const scaleX = this.loadedImage!.width / this.canvas.width;
      const scaleY = this.loadedImage!.height / this.canvas.height;
      
      const scaledRegions = this.regions.map(region => ({
        x: Math.round(region.x * scaleX),
        y: Math.round(region.y * scaleY),
        width: Math.round(region.width * scaleX),
        height: Math.round(region.height * scaleY)
      }));

      const result = await this.processor.process(this.file, scaledRegions, effect);
      this.showResult(result);
    } catch (error) {
      this.showError(error instanceof Error ? error.message : 'Processing failed');
    } finally {
      this.processBtn.disabled = false;
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

  destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    
    Object.values(this.components).forEach(comp => comp?.destroy?.());
    
    if (this.resultImg.src && this.resultImg.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.resultImg.src);
    }

    if (this.loadedImage?.src && this.loadedImage.src.startsWith('blob:')) {
      URL.revokeObjectURL(this.loadedImage.src);
    }
    
    this.container.innerHTML = '';
  }
}
