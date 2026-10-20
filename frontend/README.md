# Frontend

The web interface (React + TypeScript + Vite). `npm run build` writes it to
`backend/app/static/`, from where the Python server serves it.

- `npm run dev`: development server with instant reload (start the Python
  server first; API calls are forwarded to it).
- `npm test`: unit tests (Vitest).
- `npm run typecheck`: TypeScript checks.

Interface texts live in `src/i18n/`: `en.ts` is the reference, and TypeScript
reports any key missing from another language.
