import { effect, Service, signal } from '@angular/core';

const STORAGE_KEY = 'metr-index-theme';
export const DARK_MODE_CLASS = 'app-dark';

@Service()
export class Theme {
  readonly isDark = signal(this.resolveInitialTheme());

  constructor() {
    effect(() => {
      document.documentElement.classList.toggle(DARK_MODE_CLASS, this.isDark());
    });
  }

  toggle(): void {
    const next = !this.isDark();
    this.isDark.set(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? 'dark' : 'light');
    } catch {
      // localStorage unavailable (private browsing, disabled storage) — in-memory state still works
    }
  }

  private resolveInitialTheme(): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'dark') return true;
      if (stored === 'light') return false;
    } catch {
      // fall through to system preference
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
