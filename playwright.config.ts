import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: "http://127.0.0.1:5174",
    channel: "msedge",
    launchOptions: {
      args: [
        "--use-fake-device-for-media-stream",
        "--use-fake-ui-for-media-stream",
      ],
    },
    headless: true,
    reducedMotion: "reduce",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -- --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: { NUMA_DEV_API_TARGET: "http://127.0.0.1:8001" },
      reuseExistingServer: false,
    },
    {
      command:
        "powershell -NoProfile -Command \"$env:NUMA_DEMO_MODE='true'; $env:DATABASE_URL=' '; .\\.venv\\Scripts\\python.exe -m uvicorn backend.app:create_app --factory --host 127.0.0.1 --port 8001\"",
      url: "http://127.0.0.1:8001/api/health",
      reuseExistingServer: false,
    },
  ],
});
