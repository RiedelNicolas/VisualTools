import type { EventCallback, UnsubscribeFunction } from '../types.ts';

/**
 * Simple event bus for pub-sub communication between components
 */
class EventBus {
  private listeners: Map<string, Set<EventCallback>>;

  constructor() {
    this.listeners = new Map();
  }

  on<T = unknown>(event: string, callback: EventCallback<T>): UnsubscribeFunction {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const callbacks = this.listeners.get(event);
    callbacks?.add(callback as EventCallback);

    return () => this.off(event, callback);
  }

  off<T = unknown>(event: string, callback: EventCallback<T>): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      callbacks?.delete(callback as EventCallback);
    }
  }

  emit<T = unknown>(event: string, data: T): void {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      callbacks?.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event handler for "${event}":`, error);
        }
      });
    }
  }

  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const eventBus = new EventBus();
