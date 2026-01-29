import type { AppState, StateKey, StateValue, UnsubscribeFunction } from '../types.ts';

type StateCallback<K extends StateKey = StateKey> = (value: StateValue<K>, key: string) => void;

class StateManager {
  private state: AppState;
  private subscribers: Map<string, Set<StateCallback>>;

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

  getState(): AppState;
  getState<K extends StateKey>(key: K): StateValue<K>;
  getState<K extends StateKey>(key?: K): AppState | StateValue<K> {
    if (key) {
      return this.state[key];
    }
    return { ...this.state };
  }

  setState(updates: Partial<AppState>): void {
    const changedKeys: StateKey[] = [];
    
    for (const [key, value] of Object.entries(updates) as [StateKey, StateValue<StateKey>][]) {
      if (this.state[key] !== value) {
        (this.state[key] as StateValue<StateKey>) = value;
        changedKeys.push(key);
      }
    }

    changedKeys.forEach(key => {
      this.notify(key, this.state[key]);
    });

    if (changedKeys.length > 0) {
      this.notify('*', this.state);
    }
  }

  subscribe<K extends StateKey>(key: K | '*', callback: StateCallback<K>): UnsubscribeFunction {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    const callbacks = this.subscribers.get(key);
    callbacks?.add(callback as StateCallback);

    return () => {
      const callbacks = this.subscribers.get(key);
      callbacks?.delete(callback as StateCallback);
    };
  }

  private notify<K extends StateKey>(key: K | '*', value: StateValue<K> | AppState): void {
    if (this.subscribers.has(key)) {
      const callbacks = this.subscribers.get(key);
      callbacks?.forEach(callback => {
        try {
          callback(value as StateValue<StateKey>, key);
        } catch (error) {
          console.error(`Error in state subscriber for "${key}":`, error);
        }
      });
    }
  }

  reset(): void {
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

export const stateManager = new StateManager();
