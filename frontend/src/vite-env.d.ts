/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Tell TypeScript to treat CSS files as valid side-effect imports.
// Vite handles the actual transformation; this declaration silences tsc.
declare module '*.css';
