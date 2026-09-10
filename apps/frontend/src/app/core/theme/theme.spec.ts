import { TestBed } from '@angular/core/testing';
import { DARK_MODE_CLASS, Theme } from './theme';

describe('Theme', () => {
  let service: Theme;

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_MODE_CLASS);
    TestBed.configureTestingModule({});
    service = TestBed.inject(Theme);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('toggles the dark-mode signal and persists the choice', () => {
    const initial = service.isDark();

    service.toggle();

    expect(service.isDark()).toBe(!initial);
    expect(localStorage.getItem('metr-index-theme')).toBe(!initial ? 'dark' : 'light');
  });
});
