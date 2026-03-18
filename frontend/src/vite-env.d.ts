/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module '*.yaml' {
  const content: Record<string, unknown>;
  export default content;
}
