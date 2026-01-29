import { stateManager } from '../core/state-manager.ts';
import type { UnsubscribeFunction } from '../types.ts';

export class ProgressBar {
  private container: HTMLElement;
  private unsubscribers: UnsubscribeFunction[];
  private progressContainer!: HTMLElement;
  private messageEl!: HTMLElement;
  private fillEl!: HTMLElement;
  private percentageEl!: HTMLElement;
  private currentProgress: number;

  constructor(container: HTMLElement) {
    this.container = container;
    this.unsubscribers = [];
    this.currentProgress = 0;
    this.render();
    this.subscribe();
  }

  private render(): void {
    this.container.innerHTML = `
      <div class="progress-container hidden">
        <div class="progress-message"></div>
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <div class="progress-percentage">0%</div>
      </div>
    `;

    const container = this.container.querySelector('.progress-container');
    const message = this.container.querySelector('.progress-message');
    const fill = this.container.querySelector('.progress-fill');
    const percentage = this.container.querySelector('.progress-percentage');

    if (!container || !message || !fill || !percentage) {
      throw new Error('Failed to initialize progress bar elements');
    }

    this.progressContainer = container as HTMLElement;
    this.messageEl = message as HTMLElement;
    this.fillEl = fill as HTMLElement;
    this.percentageEl = percentage as HTMLElement;
  }

  private subscribe(): void {
    this.unsubscribers.push(
      stateManager.subscribe('progress', (progress) => {
        this.updateProgress(progress as number);
      })
    );

    this.unsubscribers.push(
      stateManager.subscribe('progressMessage', (message) => {
        this.updateMessage(message as string);
      })
    );

    this.unsubscribers.push(
      stateManager.subscribe('processing', (processing) => {
        if (processing) {
          this.show();
        } else {
          setTimeout(() => {
            if (!stateManager.getState('processing')) {
              this.hide();
            }
          }, 500);
        }
      })
    );

    this.unsubscribers.push(
      stateManager.subscribe('ffmpegLoading', (loading) => {
        if (loading) {
          this.show();
        }
      })
    );
  }

  private updateProgress(progress: number): void {
    const clampedProgress = Math.min(100, Math.max(0, progress));
    
    // Only update if progress increases (monotonic) to avoid race conditions
    if (clampedProgress < this.currentProgress) {
      return;
    }
    
    this.currentProgress = clampedProgress;
    this.fillEl.style.width = `${clampedProgress}%`;
    this.percentageEl.textContent = `${clampedProgress}%`;
    
    if (clampedProgress >= 100) {
      this.fillEl.classList.add('complete');
      // Hide progress bar when it reaches 100% to show spinner instead
      setTimeout(() => {
        if (stateManager.getState('processing')) {
          this.hide();
        }
      }, 500);
    } else {
      this.fillEl.classList.remove('complete');
    }
  }

  private updateMessage(message: string): void {
    this.messageEl.textContent = message;
  }

  private show(): void {
    this.progressContainer.classList.remove('hidden');
  }

  private hide(): void {
    this.progressContainer.classList.add('hidden');
    this.currentProgress = 0;
    this.updateProgress(0);
    this.updateMessage('');
  }

  setIndeterminate(isIndeterminate: boolean): void {
    if (isIndeterminate) {
      this.fillEl.classList.add('indeterminate');
      this.percentageEl.textContent = '';
    } else {
      this.fillEl.classList.remove('indeterminate');
    }
  }

  destroy(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.container.innerHTML = '';
  }
}
