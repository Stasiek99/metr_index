import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { DARK_MODE_CLASS } from '../../core/theme/theme';
import { Shell } from './shell';

describe('Shell', () => {
  beforeEach(async () => {
    localStorage.clear();
    document.documentElement.classList.remove(DARK_MODE_CLASS);

    await TestBed.configureTestingModule({
      imports: [Shell],
      providers: [provideRouter([]), providePrimeNG({ theme: { preset: Aura } })],
    }).compileComponents();
  });

  it('renders a nav link for every route', () => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('.shell__nav a');

    expect(links.length).toBe(3);
  });

  it('renders the data source and stat type filter fields', () => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;

    expect(compiled.querySelector('#filter-source-label')?.textContent).toBe('Źródło danych');
    expect(compiled.querySelector('#filter-stat-type-label')?.textContent).toBe('Statystyka');
  });

  it('toggles the app-dark class on the document root when the theme button is clicked', () => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.shell__theme-toggle',
    );

    expect(document.documentElement.classList.contains(DARK_MODE_CLASS)).toBe(false);

    button?.click();
    fixture.detectChanges();

    expect(document.documentElement.classList.contains(DARK_MODE_CLASS)).toBe(true);
  });
});
