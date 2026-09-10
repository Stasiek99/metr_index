# Metr Index

Analiza cen nieruchomości w Warszawie (cena/m²) — Angular 22 + PrimeNG na froncie,
Node/Express na backendzie. Architektura i pełny plan pracy: `ROADMAP.md` (lokalny, nieśledzony przez git).

## Wymagania

- Node.js **^24.15.0** (wymagane przez Angular CLI 22; jeśli używasz `nvm`, uruchom `nvm use` w
  katalogu głównym repo — patrz `.nvmrc`)
- npm 11+

## Struktura repo (npm workspaces)

```
apps/
  frontend/   -- Angular 22 (standalone, zoneless), PrimeNG
  backend/    -- Node.js + Express + TypeScript
packages/
  shared/     -- typy/DTO współdzielone między frontendem a backendem
```

## Instalacja

Jedno polecenie w katalogu głównym instaluje zależności dla wszystkich workspace'ów:

```bash
npm install
```

## Uruchomienie w trybie deweloperskim

Frontend (`http://localhost:4200`):

```bash
npm run start --workspace=frontend
```

Backend (`http://localhost:3000`, healthcheck pod `/api/health`):

```bash
npm run dev --workspace=@metr-index/backend
```

## Lint i formatowanie

```bash
npm run lint            # ESLint: backend + packages (root config) i frontend (Angular ESLint)
npm run format          # Prettier — formatuje cały workspace
npm run format:check    # Prettier — tylko sprawdza, bez zapisu
```

## Build produkcyjny

```bash
npm run build --workspace=frontend   # -> apps/frontend/dist
npm run build --workspace=@metr-index/backend    # -> apps/backend/dist
```

## Konwencje w repo

- Wspólny `.editorconfig` i `.prettierrc.json` w katalogu głównym obowiązują cały monorepo.
- `tsconfig.base.json` w katalogu głównym niesie wspólne, restrykcyjne opcje kompilatora
  (`strict`, itp.) dla `apps/backend` i `packages/shared`. `apps/frontend` ma własny
  `tsconfig.json` generowany i zarządzany przez Angular CLI — celowo nie dziedziczy z bazy,
  żeby nie kolidować z `ng update`.
- ESLint: `apps/frontend` ma własny `eslint.config.js` (schemat `@angular-eslint/schematics`,
  z lintingiem szablonów HTML). Reszta repo (`apps/backend`, `packages/shared`) korzysta
  z jednego, root-owego `eslint.config.js`.
