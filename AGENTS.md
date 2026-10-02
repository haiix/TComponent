# Repository Guidelines

## Project Structure & Module Organization

TComponent is a zero-dependency, non-reactive TypeScript component library with explicit DOM control. `src/index.ts` defines public exports; core classes live directly in `src/`. `src/internal/` contains implementation for internal use, including DOM, events, templates, IDs, slots, and lifecycle handling. `src/utils/` is the utility layer for external public APIs. Keep internal implementation in `src/internal/` and expose public utilities through `src/index.ts`; treat changes to exported utilities as public API changes.

`tests/` mirrors source modules. `documents/` contains guides included in TypeDoc, while `README.md` provides installation and usage examples. `.github/workflows/` defines CI and release automation. Generated `dist/`, `docs/`, and `coverage/` directories are ignored; do not commit them.

## Build, Test, and Development Commands

Use Node.js 24, matching CI, and install dependencies with `npm ci`.

- `npm run build`: produce the ESM library, source maps, and bundled TypeScript declarations in `dist/`.
- `npm test`: run Vitest in watch mode for local development.
- `npm run test:run`: run the complete test suite once.
- `npm run test:coverage`: generate V8 coverage reports, including HTML in `coverage/`.
- `npm run lint`: check code with ESLint's type-aware TypeScript rules.
- `npm run format`: apply Prettier across the repository; review the resulting diff.
- `npm run docs`: generate TypeDoc in `docs/`; documentation warnings fail generation.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, single quotes, and semicolons, following Prettier. Name classes and their files in PascalCase (`BuildContext.ts`); use camelCase for functions, variables, and helper modules (`applyParams.ts`). Use type-only imports, explicit function return types in source, and TSDoc for public APIs. ESLint prohibits `console`, explicit `any`, and floating promises in source. Prefix intentionally unused parameters with `_`.

## Testing Guidelines

Tests use Vitest with jsdom. Place regression tests in the matching `tests/` directory as `*.test.ts`; `*.spec.ts` is also supported. Group cases with `describe` and give `it` cases descriptive behavior names. Exercise DOM behavior, error paths, and lifecycle cleanup when affected. Coverage includes `src/**/*.ts`; no numeric coverage threshold is configured. Before submitting, run lint, the full test suite, and build, matching CI.

## Commit & Pull Request Guidelines

Recent commits use descriptive, action-led subjects such as “Add”, “Improve”, and “Refactor”, often followed by a PR number. Follow that style and keep commits focused. PR descriptions should explain the problem, resulting behavior, and validation commands; link relevant issues and update usage documentation for public API changes. Report vulnerabilities privately as described in `SECURITY.md`.
