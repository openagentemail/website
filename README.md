# openagent.email website

Marketing site and docs for [openagent.email](https://openagent.email) — self-hosted email for AI agents.

- Stack: [Astro](https://astro.build) 5 + [Starlight](https://starlight.astro.build)
- Pages: `src/pages/` (home, pricing, legal, alternatives)
- Docs: `src/content/docs/docs/` → `/docs/`
- Connect guide: `/docs/guides/connect-your-agent/` (CLI / desktop / web chat)
- Design tokens and motion language: `DESIGN.md`

```bash
npm install
npm run dev      # http://localhost:4321
npm run build
npm run preview
```

## Compare freshness gate

`npm run build` intentionally fails closed when `/compare`'s `Last checked` date is more than 90 days old. When it fails, recheck the official AgentMail sources, update the comparison facts, and refresh `Last checked`. Use `npm run test:compare-freshness` to run that gate directly; it is a deliberate deployment safeguard, not an optional warning.

Do not commit `.env`. Copy on the homepage feature cards **and** the homepage FAQ (`const faq` in `src/pages/index.astro`) is owner-approved — do not rephrase it. FAQPage JSON-LD is generated from that same `faq` array.
