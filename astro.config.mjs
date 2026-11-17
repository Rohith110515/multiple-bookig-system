// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server',            // pages render on the server, so they can hold secrets
  adapter: node({ mode: 'standalone' }),
});