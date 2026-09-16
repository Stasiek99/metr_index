import { provideHttpClient, withFetch } from '@angular/common/http';
import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { definePreset } from '@primeuix/themes';
import Aura from '@primeuix/themes/aura';
import { providePrimeNG } from 'primeng/config';
import { DARK_MODE_CLASS } from './core/theme/theme';
import { routes } from './app.routes';

// ngx-echarts is provided per-feature-component (see price-trends-page.ts), not here —
// registering it at the root would pull echarts into the eager main bundle instead of the
// lazy route chunk that actually needs it.

// Aura's defaults fail WCAG 2 AA in light mode (verified with axe-core, Faza 7 a11y audit):
// - primary.color = emerald.500 (#10b981) gives white button text only 2.53:1 contrast
//   (needs 4.5:1) — bumped two shades to emerald.700/800/900, which the dark-mode branch
//   already avoids (it uses the lighter 400/300/200 shades and passed the audit as-is).
// - togglebutton's unselected label/icon color = surface.500 (#64748b on #f1f5f9) gives
//   4.34:1, just under the 4.5:1 threshold — bumped to surface.600.
// (our own status/error text color fix lives in styles.scss as a plain custom property,
// not here — PrimeNG's `semantic.text` preset type only allows its 4 existing keys, so it
// can't carry an app-specific `errorColor` the way primary/togglebutton could be overridden.)
const MetrIndexPreset = definePreset(Aura, {
  semantic: {
    primary: {
      color: 'light-dark({primary.700}, {primary.400})',
      hoverColor: 'light-dark({primary.800}, {primary.300})',
      activeColor: 'light-dark({primary.900}, {primary.200})',
    },
  },
  components: {
    togglebutton: {
      root: {
        color: 'light-dark({surface.600}, {surface.400})',
      },
      icon: {
        color: 'light-dark({surface.600}, {surface.400})',
      },
    },
  },
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withFetch()),
    providePrimeNG({
      theme: {
        preset: MetrIndexPreset,
        options: {
          darkModeSelector: `.${DARK_MODE_CLASS}`,
        },
      },
    }),
  ],
};
