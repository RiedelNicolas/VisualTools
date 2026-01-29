import { readFileAsDataURL } from '../utils/file-handler.js';

/**
 * Image preview component for displaying uploaded images
 */
export class ImagePreview {
  /**
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.container = container;
    this.render();
  }

  render() {
    this.container.innerHTML = `
      <div class="image-preview">
        <div class="preview-images"></div>
      </div>
    `;

    this.previewContainer = this.container.querySelector('.preview-images');
  }

  /**
   * Update preview with new files
   * @param {File[]} files - Image files to preview
   */
  async update(files) {
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

  /**
   * Show comparison preview (side by side)
   * @param {File[]} files - Two image files
   */
  async showComparison(files) {
    this.previewContainer.innerHTML = '';
    this.previewContainer.classList.add('comparison-preview');

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
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

  clear() {
    this.previewContainer.innerHTML = '';
    this.previewContainer.classList.remove('comparison-preview');
  }

  destroy() {
    this.container.innerHTML = '';
  }
}
