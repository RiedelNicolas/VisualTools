import { readFileAsDataURL } from '../utils/file-handler.ts';

export class ImagePreview {
  private container: HTMLElement;
  private previewContainer!: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="image-preview">
        <div class="preview-images"></div>
      </div>
    `;

    const preview = this.container.querySelector('.preview-images');
    if (!preview) {
      throw new Error('Failed to initialize preview container');
    }
    this.previewContainer = preview as HTMLElement;
  }

  async update(files: File[]): Promise<void> {
    this.previewContainer.innerHTML = '';

    if (files.length === 0) {
      return;
    }

    for (const file of files) {
      const dataUrl = await readFileAsDataURL(file);
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = file.name;
      img.className = 'preview-image';
      this.previewContainer.appendChild(img);
    }
  }

  async showComparison(files: File[]): Promise<void> {
    this.previewContainer.innerHTML = '';
    this.previewContainer.classList.add('comparison-preview');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file) continue;
      
      const dataUrl = await readFileAsDataURL(file);
      
      const wrapper = document.createElement('div');
      wrapper.className = 'comparison-image-wrapper';
      
      const img = document.createElement('img');
      img.src = dataUrl;
      img.alt = file.name;
      
      const label = document.createElement('span');
      label.className = 'image-label';
      label.textContent = i === 0 ? 'Left' : 'Right';
      
      wrapper.appendChild(img);
      wrapper.appendChild(label);
      
      this.previewContainer.appendChild(wrapper);
    }
  }

  clear(): void {
    this.previewContainer.innerHTML = '';
    this.previewContainer.classList.remove('comparison-preview');
  }

  destroy(): void {
    this.container.innerHTML = '';
  }
}
