import { defineConfig } from '@playwright/test';

const deployedURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = deployedURL
  ? `${deployedURL.replace(/\/+$/, '')}/`
  : 'http://127.0.0.1:8091/eveonline-fwsim/';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: deployedURL ? undefined : {
    command: 'npm run build:pages && python3 -m http.server 8091 --bind 127.0.0.1 --directory _site',
    url: baseURL,
    reuseExistingServer: false,
    stderr: 'ignore'
  }
});
