import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

interface NavLink {
  label: string;
  path: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly navLinks: NavLink[] = [
    { label: 'Trendy cen', path: '/trendy' },
    { label: 'Manipulacje', path: '/manipulacje' },
    { label: 'Porównanie miast', path: '/porownanie-miast' },
  ];
}
