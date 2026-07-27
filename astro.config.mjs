import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// Static marketing site for openagent.email — no framework islands,
// a few vanilla-JS enhancements shipped as-is.
// Docs live under /docs/ via Starlight (content: src/content/docs/docs/).
export default defineConfig({
  site: 'https://openagent.email',
  output: 'static',
  integrations: [
    starlight({
      title: 'openagent.email',
      description: 'Self-hosted email for AI agents — docs',
      logo: { src: './public/logo.svg' },
      favicon: '/favicon.svg',
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/openagentemail/openagentemail' },
      ],
      customCss: ['./src/styles/starlight-custom.css'],
      sidebar: [
        {
          label: 'Start here',
          items: [
            { label: 'Introduction', slug: 'docs' },
            { label: 'Get a VPS', slug: 'docs/get-a-vps' },
            { label: 'Quickstart', slug: 'docs/quickstart' },
          ],
        },
        {
          label: 'Guides',
          items: [
            'docs/guides/dns-setup',
            'docs/guides/deliverability',
            'docs/guides/security',
          ],
        },
        {
          label: 'Reference',
          items: [
            'docs/reference/api',
            'docs/reference/mcp-clients',
          ],
        },
      ],
    }),
  ],
});
