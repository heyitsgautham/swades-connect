interface DOMWatcherConfig {
  onChange: () => void;
  debounceMs?: number;
  targetSelectors?: string[];
}

export class DOMWatcher {
  private observer: MutationObserver | null = null;
  private debounceTimer: number | null = null;
  private config: Required<DOMWatcherConfig>;

  constructor(config: DOMWatcherConfig) {
    this.config = {
      debounceMs: 500,
      targetSelectors: ['.o_content', '.o_list_view', '.o_kanban_view', '.o_form_view'],
      ...config
    };
  }

  start(): void {
    if (this.observer) return;

    this.observer = new MutationObserver((mutations) => {
      // Filter mutations to only ACTUAL data changes, not view/filter changes
      const relevantChange = mutations.some((mutation) => {
        // Ignore attribute changes (like classes for view switching)
        if (mutation.type === 'attributes') {
          return false;
        }

        const target = mutation.target as HTMLElement;
        
        // Only care about changes inside data rows/records
        const isDataRow = 
          target.closest('.o_data_row') || // List view row
          target.closest('.o_kanban_record') || // Kanban card
          target.matches('.o_data_row') ||
          target.matches('.o_kanban_record') ||
          // Check if added/removed nodes are data rows
          Array.from(mutation.addedNodes).some(node => 
            (node as HTMLElement).classList?.contains('o_data_row') ||
            (node as HTMLElement).classList?.contains('o_kanban_record')
          ) ||
          Array.from(mutation.removedNodes).some(node => 
            (node as HTMLElement).classList?.contains('o_data_row') ||
            (node as HTMLElement).classList?.contains('o_kanban_record')
          );

        // Ignore changes to pager, filters, search box, view switcher
        const isUIControl =
          target.closest('.o_pager') ||
          target.closest('.o_cp_searchview') ||
          target.closest('.o_cp_switch_buttons') ||
          target.closest('.o_searchview_facet') ||
          target.closest('.o_filter_menu') ||
          target.matches('.o_pager') ||
          target.matches('.o_cp_searchview');

        return isDataRow && !isUIControl;
      });

      if (relevantChange) {
        console.log('[Swades Connect] Detected actual data change (not view/filter change)');
        this.debouncedOnChange();
      }
    });

    // Observe the entire document with optimized config
    this.observer.observe(document.body, {
      childList: true,      // Watch for added/removed nodes
      subtree: true,        // Watch entire tree
      attributes: false,    // Ignore attribute changes for performance
      characterData: false  // Ignore text changes
    });

    console.log('[Swades Connect] DOM Watcher started');
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
      console.log('[Swades Connect] DOM Watcher stopped');
    }
    
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  isActive(): boolean {
    return this.observer !== null;
  }

  private debouncedOnChange(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = window.setTimeout(() => {
      console.log('[Swades Connect] DOM change detected, triggering callback...');
      this.config.onChange();
      this.debounceTimer = null;
    }, this.config.debounceMs);
  }
}

// Singleton instance for easy management
let globalWatcher: DOMWatcher | null = null;

export function startDOMWatcher(onChange: () => void, debounceMs = 1000): void {
  if (globalWatcher) {
    globalWatcher.stop();
  }
  globalWatcher = new DOMWatcher({ onChange, debounceMs });
  globalWatcher.start();
}

export function stopDOMWatcher(): void {
  if (globalWatcher) {
    globalWatcher.stop();
    globalWatcher = null;
  }
}

export function isDOMWatcherActive(): boolean {
  return globalWatcher?.isActive() ?? false;
}
