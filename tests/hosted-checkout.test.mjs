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
const externalCtaHrefs = Array.from(
  pricing.matchAll(/<a\b(?=[^>]*\bclass="[^"]*\bbtn\b[^"]*")[^>]*\bhref="(https?:\/\/[^"\s]+)"/gi),
  ([, href]) => href,
);
const staticPaymentPathOrToken = /(?:^|[/?#&=_.-])(?:checkout|payment|pay|token)(?:$|[/?#&=_.-])/i;
const isStaticPaymentCtaHref = (href) => {
  const { pathname, search, hash } = new URL(href);
  return staticPaymentPathOrToken.test(`${pathname}${search}${hash}`);
};

assert.match(pricing, /<a class="btn btn-gold" href="mailto:support@openagent\.email\?subject=Hosted%20Pro%20waitlist">Join the Hosted Pro waitlist →<\/a>/, 'Hosted CTA must target the waitlist');
assert.doesNotMatch(pricing, /https:\/\/hosted\.openagent\.email\/checkout\/one-time\?product_id=prod_2MmEOwu9ph2BJA9JYpLjaB/, 'Pricing must not contain the dead static checkout URL');
assert.doesNotMatch(pricing, /creem\.io\/payment\//, 'A static payment link cannot collect verified customer identity metadata');
assert.equal(isStaticPaymentCtaHref('https://billing.example/checkout/one-time'), true, 'Generic guard must reject an external checkout path');
assert.equal(isStaticPaymentCtaHref('https://billing.example/start?token=static-payment-token'), true, 'Generic guard must reject an external payment token');
assert.equal(isStaticPaymentCtaHref('https://pay.example/docs/quickstart/'), false, 'Generic guard must not reject a non-payment path because of its hostname');
assert.ok(externalCtaHrefs.every((href) => !isStaticPaymentCtaHref(href)), 'CTA must not use an external static checkout or payment link');
assert.match(pricing, /<h2>Self-hosted<\/h2>/, 'Self-hosted pricing content must remain unchanged');
assert.match(pricing, /<a class="btn btn-ghost" href="\/docs\/quickstart\/">Get started →<\/a>/, 'Self-host CTA must remain unchanged');
assert.match(pricing, /<span class="badge">Waitlist<\/span>/, 'Hosted badge must say Waitlist');
assert.doesNotMatch(pricing, /Available now/, 'Hosted badge must not say Available now');
assert.match(pricing, /Join the waitlist\. We will email you when a slot opens\./, 'Last Hosted selling point must be the waitlist');
assert.match(pricing, /When checkout opens, Alipay will be the payment method\./, 'Hosted payment copy must be future-tense Alipay');
assert.match(pricing, /Hosted Pro is a one-time purchase, currently waitlist\. We will share the price when checkout opens\./, 'Notes must use waitlist framing and not invent a price');
assert.match(pricing, /openagent\.email is free and open source\. Hosted Pro is a one-time purchase, currently waitlist\./, 'Pricing meta must use waitlist framing');
assert.doesNotMatch(pricing, /Apple Pay|credit card/i, 'Hosted checkout copy must not promise unavailable payment methods');
assert.match(layout, /href="\/refund-policy"/, 'Legal navigation must link the approved refund policy');
assert.match(layout, /href="\/contact"/, 'Legal navigation must link the approved contact page');
assert.match(refundPolicy, /Hosted Pro is a one-time purchase, currently waitlist\. Public checkout is not open\./, 'Approved refund policy page must exist with approved waitlist copy');
assert.match(refundPolicy, /When checkout opens and a hosted instance is provisioned for an order, payments are generally\s+non-refundable once provisioning has started\./, 'Refund policy must describe future provisioning, not an open checkout');
assert.match(refundPolicy, /If you are later charged in error, experience a duplicate charge, or cannot use the service because\s+of a fault on our side, contact us within 14 days of purchase\./, 'Refund policy must keep the 14-day contact window for later charges');
assert.match(refundPolicy, /To request help after a purchase, include the email used on the order\./, 'Refund help request must ask for the order email');
assert.match(refundPolicy, /Payment: When checkout opens, Alipay will be the available method\. We do not offer credit-card or\s+Apple Pay checkout\./, 'Refund payment copy must be future-tense Alipay');
assert.match(contact, /support@openagent\.email/, 'Approved contact page must exist with approved support address');

// R3 P1: the public offer, terms, and refund policy must use the same one-time framing.
assert.doesNotMatch(homepage, /Hosted Pro starts at \$5\/month with a 3-day free trial/, 'Homepage FAQ must not advertise a monthly trial');
assert.doesNotMatch(homepage, /join the early-bird plan/i, 'Homepage CTA must not advertise the retired early-bird plan');
assert.match(homepage, /If you would rather not run a server, Hosted Pro is a one-time purchase, currently waitlist — see our pricing\./, 'Homepage FAQ must state the one-time waitlist offer');
assert.match(homepage, /<a class="manual-link" href="\/pricing">No VPS\? Hosted Pro is a one-time purchase, currently waitlist →<\/a>/, 'Homepage hero secondary must use waitlist copy and still link /pricing');
assert.doesNotMatch(homepage, /buy Hosted Pro/, 'Homepage must not say buy Hosted Pro');
assert.doesNotMatch(homepage, /Hosted Pro is available as a one-time purchase/, 'Homepage must not claim Hosted Pro is available now');
assert.doesNotMatch(terms, /subscription basis|billed monthly or yearly|free 3-day trial|cancel anytime|paid period|subscription fees/i, 'Terms must not describe a retired subscription offer');
assert.match(terms, /one-time purchase/, 'Terms must state the one-time offer');
assert.match(terms, /Refund Policy/, 'Terms must direct refund requests to the refund policy');

// Waitlist is mailto support; later Hosted Pro bullets stay as future purchase rules.
const privacyCopy = normalizeWhitespace(privacy);
assert.doesNotMatch(privacyCopy, /collects no personal data|No accounts, no sign-ups, no forms that collect personal information|If you\s+subscribe/i, 'Privacy policy must not deny contact data or describe a subscription');
assert.doesNotMatch(privacyCopy, /Hosted Pro checkout form/, 'Privacy policy must not claim a checkout form is open now');
assert.match(privacyCopy, /<p class="lede"> The short version: when you self-host openagent\.email, your mail data stays on your server\. The Hosted Pro waitlist is a mailto to support@openagent\.email, used only to reply about the waitlist\. This website uses no tracking cookies\. <\/p>/, 'Privacy lede must disclose the waitlist mailto');
assert.match(privacyCopy, /<h2>This website<\/h2> <ul> <li> The Hosted Pro waitlist is a mailto to support@openagent\.email, used only to reply about the waitlist\. <\/li>/, 'Privacy website disclosure must describe the waitlist mailto');
assert.match(privacyCopy, /<h2>Hosted Pro<\/h2> <p> Our optional hosted service is for people who don't want to run their own server\. If you make a one-time purchase, the following applies: <\/p>/, 'Hosted Pro intro must exactly match the approved copy');
