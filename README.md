# openagent.email website

Marketing site and docs for [openagent.email](https://openagent.email) — self-hosted email for AI agents.

- Stack: [Astro](https://astro.build) 5 + [Starlight](https://starlight.astro.build)
- Pages: `src/pages/` (home, pricing, legal, alternatives)
- Docs: `src/content/docs/docs/` → `/docs/`
- Design tokens and motion language: `DESIGN.md`

```bash
npm install
npm run dev      # http://localhost:4321
npm run build
npm run preview
```

Do not commit `.env`. Copy on the homepage feature cards **and** the homepage FAQ (`const faq` in `src/pages/index.astro`) is owner-approved — do not rephrase it. FAQPage JSON-LD is generated from that same `faq` array.
