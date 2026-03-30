const path = require("path");
const { defineConfig, devices } = require("@playwright/test");

const rootDir = path.resolve(__dirname, "..");

module.exports = defineConfig({
  testDir: path.join(__dirname, "tests"),
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on",
    launchOptions: {
      args: [
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--enable-accelerated-2d-canvas",
        "--use-gl=angle",
        "--use-angle=swiftshader",
      ],
    },
  },
  webServer: [
    {
      command: "./venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: path.join(rootDir, "backend"),
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173",
      cwd: path.join(rootDir, "frontend"),
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
