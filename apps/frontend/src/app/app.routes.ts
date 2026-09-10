import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'trendy' },
  {
    path: 'trendy',
    loadComponent: () =>
      import('./features/price-trends/price-trends-page').then((m) => m.PriceTrendsPage),
  },
  {
    path: 'manipulacje',
    loadComponent: () =>
      import('./features/market-manipulation/market-manipulation-page').then(
        (m) => m.MarketManipulationPage,
      ),
  },
  {
    path: 'porownanie-miast',
    loadComponent: () =>
      import('./features/city-comparison/city-comparison-page').then((m) => m.CityComparisonPage),
  },
  { path: '**', redirectTo: 'trendy' },
];
