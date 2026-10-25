type Listener = (payload?: any) => void;

class DataEvents {
  private listeners: Record<string, Listener[]> = {};

  on(event: string, fn: Listener): () => void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(fn);

    return () => {
      this.listeners[event] = (this.listeners[event] || []).filter((l) => l !== fn);
    };
  }

  emit(event: string, payload?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach((fn) => {
        try {
          fn(payload);
        } catch (e) {
          console.error(`[DataEvents] Error in event listener for ${event}:`, e);
        }
      });
    }
  }
}

export const dataEvents = new DataEvents();
