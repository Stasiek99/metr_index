import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { Market, PriceType } from '@metr-index/shared';
import { Moon } from '@primeicons/angular/moon';
import { Sun } from '@primeicons/angular/sun';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { PriceFilters } from '../../core/filters/price-filters';
import { Theme } from '../../core/theme/theme';

interface NavLink {
  label: string;
  path: string;
}

interface FilterOption<T> {
  label: string;
  value: T;
}

@Component({
  selector: 'app-shell',
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    FormsModule,
    ButtonModule,
    SelectButtonModule,
    Moon,
    Sun,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
})
export class Shell {
  protected readonly theme = inject(Theme);
  protected readonly filters = inject(PriceFilters);

  protected readonly navLinks: NavLink[] = [
    { label: 'Trendy cen', path: '/trendy' },
    { label: 'Manipulacje', path: '/manipulacje' },
    { label: 'Porównanie miast', path: '/porownanie-miast' },
  ];

  protected readonly marketOptions: FilterOption<Market>[] = [
    { label: 'Pierwotny', value: 'primary' },
    { label: 'Wtórny', value: 'secondary' },
  ];

  protected readonly priceTypeOptions: FilterOption<PriceType>[] = [
    { label: 'Ofertowa', value: 'offer' },
    { label: 'Transakcyjna', value: 'transaction' },
  ];
}
