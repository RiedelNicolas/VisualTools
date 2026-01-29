import { stateManager } from './core/state-manager.ts';
import { eventBus } from './core/event-bus.ts';
import { ComparisonController } from './modules/comparison/comparison-controller.ts';
import { SlideshowController } from './modules/slideshow/slideshow-controller.ts';
import './assets/css/main.css';
import './assets/css/components.css';
import './assets/css/animations.css';

type ToolController = ComparisonController | SlideshowController;

class VisualToolsApp {
  private currentTool: string | null;
  private toolController: ToolController | null;
  private toolContainer!: HTMLElement;
  private tabButtons!: NodeListOf<HTMLElement>;
  private errorBanner!: HTMLElement;
  private errorText!: HTMLElement;
  private errorClose!: HTMLElement;

  constructor() {
    this.currentTool = null;
    this.toolController = null;
    this.init();
  }

  private init(): void {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  private setup(): void {
    const toolContainer = document.getElementById('tool-container');
    const tabButtons = document.querySelectorAll<HTMLElement>('.tab-btn');
    const errorBanner = document.getElementById('error-banner');
    const errorText = errorBanner?.querySelector<HTMLElement>('.error-text');
    const errorClose = errorBanner?.querySelector<HTMLElement>('.error-close');

    if (!toolContainer || !tabButtons || !errorBanner || !errorText || !errorClose) {
      console.error('Failed to find required DOM elements');
      return;
    }

    this.toolContainer = toolContainer;
    this.tabButtons = tabButtons;
    this.errorBanner = errorBanner;
    this.errorText = errorText;
    this.errorClose = errorClose;

    if (!this.checkBrowserSupport()) {
      this.showGlobalError('Your browser does not support the required features. Please use a modern browser like Chrome, Firefox, or Edge.');
      return;
    }

    this.setupTabs();
    this.setupErrorBanner();

    stateManager.subscribe('error', (error) => {
      if (error) {
        this.showGlobalError(error as string);
      }
    });

    this.switchTool('comparison');
  }

  private checkBrowserSupport(): boolean {
    const hasFileAPI = 'File' in window && 'FileReader' in window;
    const hasBlob = 'Blob' in window && 'URL' in window;
    const hasPromises = 'Promise' in window;
    
    return hasFileAPI && hasBlob && hasPromises;
  }

  private setupTabs(): void {
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset['tool'];
        if (tool && tool !== this.currentTool) {
          this.switchTool(tool);
        }
      });
    });
  }

  private setupErrorBanner(): void {
    this.errorClose.addEventListener('click', () => {
      this.hideGlobalError();
    });
  }

  private switchTool(toolName: string): void {
    if (this.toolController) {
      this.toolController.destroy();
      this.toolController = null;
    }

    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset['tool'] === toolName);
    });

    this.currentTool = toolName;
    stateManager.setState({ currentTool: toolName as 'comparison' | 'slideshow' });
    stateManager.reset();

    if (toolName === 'comparison') {
      this.toolController = new ComparisonController(this.toolContainer);
    } else if (toolName === 'slideshow') {
      this.toolController = new SlideshowController(this.toolContainer);
    }

    eventBus.emit<string>('tool-changed', toolName);
  }

  private showGlobalError(message: string): void {
    this.errorText.textContent = message;
    this.errorBanner.classList.remove('hidden');
  }

  private hideGlobalError(): void {
    this.errorBanner.classList.add('hidden');
    stateManager.setState({ error: null });
  }
}

new VisualToolsApp();
