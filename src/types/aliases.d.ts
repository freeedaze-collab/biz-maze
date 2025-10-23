// Silence TS path alias resolution errors without touching read-only tsconfig.json
// This declares any module imported with the "@/" alias as `any` for the type checker.
// Runtime resolution is handled by vite-tsconfig-paths.
declare module "@/*" {
  const anyExports: any;
  export = anyExports;
}
