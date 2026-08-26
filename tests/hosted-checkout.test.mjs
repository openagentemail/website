import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pricing = await readFile(new URL('../src/pages/pricing.astro', import.meta.url), 'utf8');
const homepage = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const layout = await readFile(new URL('../src/layouts/Legal.astro', import.meta.url), 'utf8');
const refundPolicy = await readFile(new URL('../src/pages/refund-policy.astro', import.meta.url), 'utf8');
const contact = await readFile(new URL('../src/pages/contact.astro', import.meta.url), 'utf8');
const terms = await readFile(new URL('../src/pages/terms-of-service.astro', import.meta.url), 'utf8');
const privacy = await readFile(new URL('../src/pages/privacy-policy.astro', import.meta.url), 'utf8');
const normalizeWhitespace = (text) => text.replace(/\s+/g, ' ').trim();

assert.match(pricing, /<a class="btn btn-gold" href="mailto:support@openagent\.email\?subject=Hosted%20Pro%20waitlist">Buy Hosted Pro with Alipay →<\/a>/, 'Hosted CTA must target the waitlist');
assert.doesNotMatch(pricing, /https:\/\/hosted\.openagent\.email\/checkout\/one-time\?product_id=prod_2MmEOwu9ph2BJA9JYpLjaB/, 'Pricing must not contain the dead static checkout URL');
assert.doesNotMatch(pricing, /creem\.io\/payment\//, 'A static payment link cannot collect verified customer identity metadata');
assert.match(pricing, /<h2>Self-hosted<\/h2>/, 'Self-hosted pricing content must remain unchanged');
assert.match(pricing, /<a class="btn btn-ghost" href="\/docs\/quickstart\/">Get started →<\/a>/, 'Self-host CTA must remain unchanged');
assert.match(pricing, /Alipay is currently the available payment method/i, 'Hosted checkout copy must state the available method');
assert.doesNotMatch(pricing, /Apple Pay|credit card/i, 'Hosted checkout copy must not promise unavailable payment methods');
assert.match(layout, /href="\/refund-policy"/, 'Legal navigation must link the approved refund policy');
assert.match(layout, /href="\/contact"/, 'Legal navigation must link the approved contact page');
assert.match(refundPolicy, /Hosted openagent\.email is a one-time purchase\./, 'Approved refund policy page must exist with approved copy');
assert.match(contact, /support@openagent\.email/, 'Approved contact page must exist with approved support address');

// R3 P1: the public offer, terms, and refund policy must use the same one-time framing.
assert.doesNotMatch(homepage, /Hosted Pro starts at \$5\/month with a 3-day free trial/, 'Homepage FAQ must not advertise a monthly trial');
assert.doesNotMatch(homepage, /join the early-bird plan/i, 'Homepage CTA must not advertise the retired early-bird plan');
assert.match(homepage, /Hosted Pro is available as a one-time purchase/, 'Homepage FAQ must state the one-time offer');
assert.doesNotMatch(terms, /subscription basis|billed monthly or yearly|free 3-day trial|cancel anytime|paid period|subscription fees/i, 'Terms must not describe a retired subscription offer');
assert.match(terms, /one-time purchase/, 'Terms must state the one-time offer');
assert.match(terms, /Refund Policy/, 'Terms must direct refund requests to the refund policy');

// R3 P1: Hosted Pro checkout collects identity needed for ordering and provisioning.
const privacyCopy = normalizeWhitespace(privacy);
assert.doesNotMatch(privacyCopy, /collects no personal data|No accounts, no sign-ups, no forms that collect personal information|If you\s+subscribe/i, 'Privacy policy must not deny the Hosted Pro checkout form or describe a subscription');
assert.match(privacyCopy, /<p class="lede"> The short version: when you self-host openagent\.email, your mail data stays on your server\. The Hosted Pro checkout form collects the email address and requested subdomain prefix you submit to create your order and provision the hosted service\. This website uses no tracking cookies\. <\/p>/, 'Privacy lede must exactly match the approved checkout disclosure');
assert.match(privacyCopy, /<h2>This website<\/h2> <ul> <li> The Hosted Pro checkout form collects the email address and requested subdomain prefix you submit to create your order and provision the hosted service\. <\/li>/, 'Privacy website disclosure must exactly match the approved copy');
assert.match(privacyCopy, /<h2>Hosted Pro<\/h2> <p> Our optional hosted service is for people who don't want to run their own server\. If you make a one-time purchase, the following applies: <\/p>/, 'Hosted Pro intro must exactly match the approved copy');
