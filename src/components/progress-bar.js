import { stateManager } from '../core/state-manager.js';

/**
 * Progress bar component for displaying operation progress
 */
export class ProgressBar {
  /**
   * @param {HTMLElement} container - Container element
   */
  constructor(container) {
    this.container = container;
    this.unsubscribers = [];
    this.render();
    this.subscribe();
  }

  render() {
    this.container.innerHTML = `
      <div class="progress-container hidden">
        <div class="progress-message"></div>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-percentage">0%</div>
      </div>
    `;

    this.progressContainer = this.container.querySelector('.progress-container');
    this.messageEl = this.container.querySelector('.progress-message');
    this.fillEl = this.container.querySelector('.progress-fill');
    this.percentageEl = this.container.querySelector('.progress-percentage');
  }

  subscribe() {
    // Subscribe to progress updates
    this.unsubscribers.push(
      stateManager.subscribe('progress', (progress) => {
        this.updateProgress(progress);
      })
    );

    // Subscribe to message updates
    this.unsubscribers.push(
      stateManager.subscribe('progressMessage', (message) => {
        this.updateMessage(message);
      })
    );

    // Subscribe to processing state
    this.unsubscribers.push(
      stateManager.subscribe('processing', (processing) => {
        if (processing) {
          this.show();
        } else {
          // Keep showing briefly after completion
          setTimeout(() => {
            if (!stateManager.getState('processing')) {
              this.hide();
            }
          }, 500);
        }
      })
    );

    // Also show when FFmpeg is loading
    this.unsubscribers.push(
      stateManager.subscribe('ffmpegLoading', (loading) => {
        if (loading) {
          this.show();
        }
      })
    );
  }

  updateProgress(progress) {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    this.fillEl.style.width = `${clampedProgress}%`;
    this.percentageEl.textContent = `${clampedProgress}%`;
    
    // Add completion class when done
    if (clampedProgress >= 100) {
      this.fillEl.classList.add('complete');
    } else {
      this.fillEl.classList.remove('complete');
    }
  }

  updateMessage(message) {
    this.messageEl.textContent = message;
  }

  show() {
    this.progressContainer.classList.remove('hidden');
  }

  hide() {
    this.progressContainer.classList.add('hidden');
    // Reset state
    this.updateProgress(0);
    this.updateMessage('');
  }

  setIndeterminate(isIndeterminate) {
    if (isIndeterminate) {
      this.fillEl.classList.add('indeterminate');
      this.percentageEl.textContent = '';
    } else {
      this.fillEl.classList.remove('indeterminate');
    }
  }

  destroy() {
    this.unsubscribers.forEach(unsub => unsub());
    this.container.innerHTML = '';
  }
}
