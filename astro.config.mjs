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
      // Head 覆盖只为给文档站挂「邮戳」脚本（expressive-code 的 copy 按钮不是自家组件，
      // 需要一段脚本去接它的复制成功信号）；其余部分原样交给 Starlight 默认实现。
      components: {
        Head: './src/components/DocsHead.astro',
      },
      head: [
        {
          tag: 'script',
          attrs: {
            defer: true,
            src: 'https://stats.openagent.email/script.js',
            'data-website-id': '86e6eaf7-473c-4c8d-a9bf-ea48c13742c5',
          },
        },
      ],
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
