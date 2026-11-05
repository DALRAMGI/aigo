import { defineConfig } from "@playwright/test";

// 개발 서버는 따로 띄워 둔다. BASE_URL로 다른 주소를 가리킬 수 있다.
export default defineConfig({
  testDir: "e2e",
  outputDir: "node_modules/.cache/playwright", // 저장소에 결과물이 남지 않게 한다
  use: { baseURL: process.env.BASE_URL ?? "http://localhost:3100" },
});
