import { stateManager } from './core/state-manager.js';
import { eventBus } from './core/event-bus.js';
import { ComparisonController } from './modules/comparison/comparison-controller.js';
import { SlideshowController } from './modules/slideshow/slideshow-controller.js';
import './assets/css/main.css';
import './assets/css/components.css';
import './assets/css/animations.css';

/**
 * Main application class
 */
class VisualToolsApp {
  constructor() {
    this.currentTool = null;
    this.toolController = null;
    this.init();
  }

  init() {
    // Wait for DOM
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    // Cache DOM elements
    this.toolContainer = document.getElementById('tool-container');
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.errorBanner = document.getElementById('error-banner');
    this.errorText = this.errorBanner?.querySelector('.error-text');
    this.errorClose = this.errorBanner?.querySelector('.error-close');

    // Check browser compatibility
    if (!this.checkBrowserSupport()) {
      this.showGlobalError('Your browser does not support the required features. Please use a modern browser like Chrome, Firefox, or Edge.');
      return;
    }

    // Set up tab switching
    this.setupTabs();

    // Set up error banner
    this.setupErrorBanner();

    // Subscribe to global errors
    stateManager.subscribe('error', (error) => {
      if (error) {
        this.showGlobalError(error);
      }
    });

    // Load default tool (comparison)
    this.switchTool('comparison');
  }

  checkBrowserSupport() {
    // Check for essential features
    const hasFileAPI = 'File' in window && 'FileReader' in window;
    const hasBlob = 'Blob' in window && 'URL' in window;
    const hasPromises = 'Promise' in window;
    
    return hasFileAPI && hasBlob && hasPromises;
  }

  setupTabs() {
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tool = btn.dataset.tool;
        if (tool !== this.currentTool) {
          this.switchTool(tool);
        }
      });
    });
  }

  setupErrorBanner() {
    if (this.errorClose) {
      this.errorClose.addEventListener('click', () => {
        this.hideGlobalError();
      });
    }
  }

  switchTool(toolName) {
    // Clean up current controller
    if (this.toolController) {
      this.toolController.destroy();
      this.toolController = null;
    }

    // Update tab state
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    // Update state
    this.currentTool = toolName;
    stateManager.setState({ currentTool: toolName });
    stateManager.reset();

    // Create new controller
    if (toolName === 'comparison') {
      this.toolController = new ComparisonController(this.toolContainer);
    } else if (toolName === 'slideshow') {
      this.toolController = new SlideshowController(this.toolContainer);
    }

    // Emit tool change event
    eventBus.emit('tool-changed', toolName);
  }

  showGlobalError(message) {
    if (this.errorBanner && this.errorText) {
      this.errorText.textContent = message;
      this.errorBanner.classList.remove('hidden');
    }
  }

  hideGlobalError() {
    if (this.errorBanner) {
      this.errorBanner.classList.add('hidden');
    }
    stateManager.setState({ error: null });
  }
}

// Initialize app
new VisualToolsApp();
