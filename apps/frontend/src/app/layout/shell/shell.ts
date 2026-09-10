import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Moon } from '@primeicons/angular/moon';
import { Sun } from '@primeicons/angular/sun';
import { ButtonModule } from 'primeng/button';
import { Theme } from '../../core/theme/theme';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ButtonModule, Moon, Sun],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly theme = inject(Theme);

  protected readonly navLinks: NavLink[] = [
    { label: 'Trendy cen', path: '/trendy' },
    { label: 'Manipulacje', path: '/manipulacje' },
    { label: 'Porównanie miast', path: '/porownanie-miast' },
  ];
}
