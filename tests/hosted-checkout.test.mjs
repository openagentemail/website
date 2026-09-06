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

const waitlistMailto = 'mailto:support@openagent.email?subject=Hosted%20Pro%20waitlist';
const retiredCheckoutUrl = 'https://hosted.openagent.email/checkout/one-time?product_id=prod_2MmEOwu9ph2BJA9JYpLjaB';
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const externalCtaHrefs = Array.from(
  pricing.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bbtn\b[^"]*")[^>]*\bhref="(https?:\/\/[^"\s]+)"/gi),
  ([, href]) => href,
);

// Pricing: waitlist CTA, badge, and no public Buy / Creem checkout URL.
assert.match(
  pricing,
  new RegExp(`<a class="btn btn-gold" href="${escapeRegExp(waitlistMailto)}">Join the Hosted Pro waitlist →<\\/a>`),
  'Hosted CTA must be the waitlist mailto with approved subject',
);
assert.match(pricing, /<span class="badge">Waitlist<\/span>/, 'Hosted badge must say Waitlist');
assert.doesNotMatch(pricing, /\bBuy Hosted Pro\b/, 'Pricing must not expose a public Buy CTA');
assert.doesNotMatch(pricing, new RegExp(escapeRegExp(retiredCheckoutUrl)), 'Pricing must not link the retired Creem checkout URL');
assert.doesNotMatch(pricing, /creem\.io\/payment(?:[/?#]|$)/, 'Pricing must not use a static Creem payment link');
assert.deepEqual(externalCtaHrefs, [], 'Hosted Pro must not expose an external https checkout CTA while waitlisted');
assert.match(pricing, /<h2>Self-hosted<\/h2>/, 'Self-hosted pricing content must remain unchanged');
assert.match(pricing, /<a class="btn btn-ghost" href="\/docs\/quickstart\/">Get started →<\/a>/, 'Self-host CTA must remain unchanged');
assert.match(pricing, /Hosted Pro is a one-time purchase, currently waitlist/, 'Pricing notes must frame Hosted Pro as waitlist');
assert.match(pricing, /We will share the price when checkout opens/, 'Pricing must defer price disclosure until checkout opens');
assert.doesNotMatch(pricing, /Apple Pay|credit card/i, 'Hosted checkout copy must not promise unavailable payment methods');

// Homepage waitlist strings.
assert.match(homepage, /Hosted Pro is a one-time purchase, currently waitlist/, 'Homepage FAQ must state Hosted Pro is waitlist');
assert.match(
  homepage,
  /<a class="manual-link" href="\/pricing">No VPS\? Hosted Pro is a one-time purchase, currently waitlist →<\/a>/,
  'Homepage hero secondary must state waitlist and still link /pricing',
);
assert.doesNotMatch(homepage, /Hosted Pro starts at \$5\/month with a 3-day free trial/, 'Homepage FAQ must not advertise a monthly trial');
assert.doesNotMatch(homepage, /\bBuy Hosted Pro\b/, 'Homepage must not expose a Buy Hosted Pro CTA');
assert.doesNotMatch(homepage, new RegExp(escapeRegExp(retiredCheckoutUrl)), 'Homepage must not link the retired Creem checkout URL');

// Legal nav + contact remain available.
assert.match(layout, /href="\/refund-policy"/, 'Legal navigation must link the refund policy');
assert.match(layout, /href="\/contact"/, 'Legal navigation must link the contact page');
assert.match(contact, /support@openagent\.email/, 'Contact page must exist with approved support address');

// Refund policy: waitlist framing; future-tense purchase rules when checkout opens.
assert.match(refundPolicy, /Hosted Pro is a one-time purchase, currently waitlist\. Public checkout is not open yet\./, 'Refund policy must state waitlist and closed checkout');
assert.match(refundPolicy, /When checkout opens and you purchase Hosted Pro, you may request a full refund within 30 days/, 'Refund policy must defer the 30-day refund to when checkout opens');
assert.match(refundPolicy, /Payment \(when checkout opens\): Secure checkout via Creem — Alipay supported\./, 'Refund payment copy must be future-tense for checkout open');
assert.match(refundPolicy, new RegExp(escapeRegExp(waitlistMailto)), 'Refund policy must include the waitlist mailto');
assert.doesNotMatch(refundPolicy, /\bBuy Hosted Pro\b|Early Bird is a one-time \$30\.00 payment/, 'Refund policy must not keep the retired live Early Bird purchase framing');

// Terms: currently waitlist; MoR/checkout/provisioning/refund/lawful-use/as-is apply when checkout opens.
assert.match(terms, /Hosted Pro is a one-time purchase, currently waitlist\. Public checkout is not open yet\./, 'Terms must state Hosted Pro is waitlist');
assert.match(terms, /When checkout opens, the following will apply:/, 'Terms must frame MoR rules in future tense for checkout');
assert.match(terms, /Hosted Pro will be purchased through a Merchant of Record/, 'Terms must keep MoR for when checkout opens');
assert.match(terms, /A hosted instance will be provisioned specifically for your order after successful checkout/, 'Terms must keep provisioning for when checkout opens');
assert.match(terms, /Refund Policy/, 'Terms must direct refund requests to the refund policy');
assert.match(terms, /lawful email activity/, 'Terms must keep lawful-use rules');
assert.match(terms, /provided "as is"/, 'Terms must keep as-is framing for the hosted service');
assert.match(terms, new RegExp(escapeRegExp(waitlistMailto)), 'Terms must include the waitlist mailto');
assert.doesNotMatch(terms, /subscription basis|billed monthly or yearly|free 3-day trial|cancel anytime|subscription fees/i, 'Terms must not describe a retired subscription offer');
assert.doesNotMatch(terms, /Hosted Pro Early Bird is a one-time \$30\.00 payment/, 'Terms must not keep the retired live Early Bird purchase framing');

// Privacy: waitlist mailto disclosure; defer checkout fields; Hosted section currently waitlist.
const privacyCopy = normalizeWhitespace(privacy);
assert.match(privacyCopy, /Hosted Pro is currently waitlist/, 'Privacy must say Hosted Pro is currently waitlist');
assert.match(
  privacyCopy,
  new RegExp(`To join the Hosted Pro waitlist, you can email <a href="${escapeRegExp(waitlistMailto)}">support@openagent\\.email<\\/a>`),
  'Privacy must disclose the waitlist mailto',
);
assert.match(
  privacyCopy,
  /When checkout opens, Hosted Pro checkout will collect the email address used for the order and the requested openagent\.email address prefix/,
  'Privacy must defer checkout field collection until checkout opens',
);
assert.match(
  privacyCopy,
  /<h2>Hosted Pro<\/h2> <p> Our optional hosted service is for people who don't want to run their own server\. Hosted Pro is currently waitlist\. When checkout opens and you make a one-time purchase, the following will apply: <\/p>/,
  'Hosted Pro intro must state currently waitlist and defer purchase rules',
);
assert.match(
  privacyCopy,
  /When checkout opens, Creem will be our Merchant of Record and payment processor/,
  'Privacy must keep Creem MoR in future tense for checkout open',
);
assert.doesNotMatch(privacyCopy, /The Hosted Pro checkout collects the email address/, 'Privacy must not claim checkout fields are collected while waitlisted');
assert.doesNotMatch(`${pricing}\n${homepage}`, /Buy Hosted Pro — \$30 one-time/, 'Public pages must not retain the retired Buy CTA wording');
