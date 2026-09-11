import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import type { Market, PriceType } from '@metr-index/shared';
import { Moon } from '@primeicons/angular/moon';
import { Sun } from '@primeicons/angular/sun';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { DataSourceFilter, PriceFilters, StatTypeFilter } from '../../core/filters/price-filters';
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

  protected readonly dataSourceOptions: FilterOption<DataSourceFilter>[] = [
    { label: 'Wszystkie', value: 'all' },
    { label: 'NBP', value: 'nbp' },
    { label: 'RCN', value: 'rcn' },
    { label: 'GUS', value: 'gus' },
  ];

  protected readonly statTypeOptions: FilterOption<StatTypeFilter>[] = [
    { label: 'Wszystkie', value: 'all' },
    { label: 'Średnia', value: 'mean' },
    { label: 'Mediana', value: 'median' },
  ];

  // Bound as [optionDisabled] on the SelectButtons below — PrimeNG calls this with each
  // option item itself, and re-evaluates it whenever a signal it reads changes (same
  // reactive tracking as any other template expression), so disabling stays in sync as
  // the other filter changes.
  protected readonly isDataSourceOptionDisabled = (option: FilterOption<DataSourceFilter>): boolean =>
    this.filters.isDataSourceDisabled(option.value);

  protected readonly isStatTypeOptionDisabled = (option: FilterOption<StatTypeFilter>): boolean =>
    this.filters.isStatTypeDisabled(option.value);
}
