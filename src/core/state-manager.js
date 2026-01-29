/**
 * State manager with observer pattern for reactive state management
 */
class StateManager {
  constructor() {
    this.state = {
      ffmpegLoaded: false,
      ffmpegLoading: false,
      uploadedFiles: [],
      processing: false,
      progress: 0,
      progressMessage: '',
      result: null,
      error: null,
      currentTool: 'comparison'
    };
    this.subscribers = new Map();
  }

  /**
   * Get current state or specific key
   * @param {string} [key] - State key (optional)
   * @returns {*} State value or entire state
   */
  getState(key) {
    if (key) {
      return this.state[key];
    }
    return { ...this.state };
  }

  /**
   * Update state and notify subscribers
   * @param {Object} updates - State updates
   */
  setState(updates) {
    const changedKeys = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (this.state[key] !== value) {
        this.state[key] = value;
        changedKeys.push(key);
      }
    }

    // Notify subscribers of changed keys
    changedKeys.forEach(key => {
      this.notify(key, this.state[key]);
    });

    // Also notify general subscribers
    if (changedKeys.length > 0) {
      this.notify('*', this.state);
    }
  }

  /**
   * Subscribe to state changes
   * @param {string} key - State key or '*' for all changes
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(key, callback) {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key).add(callback);

    // Return unsubscribe function
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  /**
   * Notify subscribers of a state change
   * @param {string} key - State key
   * @param {*} value - New value
   */
  notify(key, value) {
    if (this.subscribers.has(key)) {
      this.subscribers.get(key).forEach(callback => {
        try {
          callback(value, key);
        } catch (error) {
          console.error(`Error in state subscriber for "${key}":`, error);
        }
      });
    }
  }

  /**
   * Reset state to initial values
   */
  reset() {
    this.setState({
      uploadedFiles: [],
      processing: false,
      progress: 0,
      progressMessage: '',
      result: null,
      error: null
    });
  }
}

// Export singleton instance
export const stateManager = new StateManager();
