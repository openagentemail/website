import { defineConfig } from 'astro/config';

// Static marketing site for openagent.email — no framework islands,
// a few vanilla-JS enhancements shipped as-is.
export default defineConfig({
  site: 'https://openagent.email',
  output: 'static',
});
