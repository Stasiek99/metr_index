import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { DARK_MODE_CLASS } from './core/theme/theme';
import { routes } from './app.routes';

// ngx-echarts is provided per-feature-component (see price-trends-page.ts), not here —
// registering it at the root would pull echarts into the eager main bundle instead of the
// lazy route chunk that actually needs it.

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: `.${DARK_MODE_CLASS}`,
        },
      },
    }),
  ],
};
