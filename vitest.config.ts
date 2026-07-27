import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,        // lets you use `describe`/`it`/`expect` without importing them every file
    environment: 'node',  // pure logic tests don't need a browser DOM — faster than 'jsdom'
  },
});