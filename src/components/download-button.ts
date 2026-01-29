import { downloadBlob, generateFilename } from '../utils/file-handler.ts';
import type { DownloadButtonOptions } from '../types.ts';

export class DownloadButton {
  private container: HTMLElement;
  private options: Required<DownloadButtonOptions>;
  private currentOptions?: Required<DownloadButtonOptions>;
  private blob: Blob | null;
  private objectUrl: string | null;
  private button!: HTMLButtonElement;

  constructor(container: HTMLElement, options: DownloadButtonOptions = {}) {
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

  private render(): void {
    this.container.innerHTML = `
      <button class="download-btn primary-btn hidden" disabled>
        <span class="btn-icon">⬇️</span>
        <span class="btn-text">Download</span>
      </button>
    `;

    const button = this.container.querySelector('.download-btn');
    if (!button) {
      throw new Error('Failed to initialize download button');
    }
    this.button = button as HTMLButtonElement;
  }

  private attachEvents(): void {
    this.button.addEventListener('click', () => this.download());
  }

  setResult(data: Blob | Uint8Array, customOptions: Partial<DownloadButtonOptions> = {}): void {
    this.cleanup();

    this.currentOptions = { ...this.options, ...customOptions } as Required<DownloadButtonOptions>;

    if (data instanceof Uint8Array) {
      this.blob = new Blob([data as BlobPart], { type: this.currentOptions.mimeType });
    } else {
      this.blob = data;
    }

    this.objectUrl = URL.createObjectURL(this.blob);
    this.button.disabled = false;
    this.button.classList.remove('hidden');
  }

  private download(): void {
    if (!this.blob) return;

    const opts = this.currentOptions || this.options;
    const filename = generateFilename(opts.prefix, opts.extension);
    downloadBlob(this.blob, filename);
  }

  private cleanup(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.blob = null;
  }

  hide(): void {
    this.button.classList.add('hidden');
    this.button.disabled = true;
    this.cleanup();
  }

  show(): void {
    if (this.blob) {
      this.button.classList.remove('hidden');
      this.button.disabled = false;
    }
  }

  destroy(): void {
    this.cleanup();
    this.container.innerHTML = '';
  }
}
