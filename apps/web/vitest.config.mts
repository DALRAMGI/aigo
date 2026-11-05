import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": import.meta.dirname } },
  test: { environment: "jsdom", globals: true, env: { NEXT_PUBLIC_API_URL: "http://api.test" } },
});
