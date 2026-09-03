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

## Continuous integration

`.github/workflows/ci.yml` provides the repository-side check that used to exist only on a
developer machine. The required check is the **`build`** job of the **`ci`** workflow. It runs
on every pull request, on pushes to `main`, weekly (Monday 06:17 UTC) and on demand, and it
does two things: `npm ci` to install exactly the pinned dependency tree, then `npm run build`,
which is the canonical build and therefore also runs the `prebuild` and `postbuild` gate
scripts through the npm lifecycle. Generated `dist/` and `.astro/` output stays out of git via
`.gitignore`; the workflow does not upload or commit it.

To make it enforced rather than advisory: Settings → Branches → add a rule for `main` →
"Require status checks to pass" → search for and select `build`.

The weekly run exists because of the freshness gate below, which fails closed against the real
UTC clock rather than only when someone happens to open a pull request.

## Compare freshness gate

`npm run build` intentionally fails closed when `/compare`'s `Last checked` dates are more than 90 days old, using the build host's UTC clock (which must be synchronized). Within 14 days of expiry it prints a proactive maintenance warning; after 90 days it fails closed. Each compared vendor carries its own date and its own primary sources — AgentMail in `src/data/agentmailSources.js`, MailSlurp in `src/data/mailslurpSources.js` — and each is gated separately, so a stale MailSlurp recheck blocks the build even while the AgentMail date is still fresh. Recheck the official sources, update the comparison facts, and refresh the dates. Use `npm run test:compare-freshness` to run that gate directly; it is a deliberate deployment safeguard, not an optional warning. Its postbuild step parses `dist/compare/index.html` to verify the rendered dates and official source links. When a recheck intentionally changes an official source set, update the matching golden digest (`requiredAgentmailSourcesDigest` or `requiredMailslurpSourcesDigest`) in `tests/compare-facts.test.mjs` with that reviewed change.

Do not commit `.env`. Copy on the homepage feature cards **and** the homepage FAQ (`const faq` in `src/pages/index.astro`) is owner-approved — do not rephrase it. FAQPage JSON-LD is generated from that same `faq` array.
