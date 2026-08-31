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

const hostedCheckoutUrl = 'https://hosted.openagent.email/checkout/one-time?product_id=prod_2MmEOwu9ph2BJA9JYpLjaB';
assert.match(pricing, new RegExp(`<a class="btn btn-gold" href="${hostedCheckoutUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}">Buy Hosted Pro — \\$30/year →<\\/a>`), 'Hosted CTA must target the exact live checkout URL');
assert.doesNotMatch(pricing, /creem\.io\/payment(?:[/?#]|$)/, 'A static payment link cannot collect verified customer identity metadata');
assert.deepEqual(externalCtaHrefs, [hostedCheckoutUrl], 'Hosted Pro must expose only the approved external checkout CTA');
assert.match(pricing, /<h2>Self-hosted<\/h2>/, 'Self-hosted pricing content must remain unchanged');
assert.match(pricing, /<a class="btn btn-ghost" href="\/docs\/quickstart\/">Get started →<\/a>/, 'Self-host CTA must remain unchanged');
assert.match(pricing, /<span class="badge">Early Bird<\/span>/, 'Hosted badge must say Early Bird');
assert.doesNotMatch(pricing, /Available now/, 'Hosted badge must not say Available now');
assert.match(pricing, /Early birds keep the \$30\.00\/year price when they renew/, 'Hosted benefits must preserve the renewal price');
assert.match(pricing, /Early bird — \$30\.00 for a full year \(regular \$5\.00\/month\)\. One-time payment, no\s+auto-renewal; early birds keep \$30\.00\/yr on renewal\. Secure checkout via Creem — Alipay\s+supported\./, 'Hosted payment and offer copy must match the approved facts');
assert.match(pricing, /Hosted Pro Early Bird is a one-time \$30\.00 payment for one year, with no auto-renewal\./, 'Notes must state the public early-bird offer');
assert.match(pricing, /openagent\.email is free and open source\. Hosted Pro Early Bird is available for \$30\.00\/year as a one-time payment\./, 'Pricing meta must state the public offer');
assert.doesNotMatch(pricing, /Apple Pay|credit card/i, 'Hosted checkout copy must not promise unavailable payment methods');
assert.match(layout, /href="\/refund-policy"/, 'Legal navigation must link the approved refund policy');
assert.match(layout, /href="\/contact"/, 'Legal navigation must link the approved contact page');
assert.match(refundPolicy, /Hosted Pro Early Bird is a one-time \$30\.00 payment for one year\./, 'Refund policy must state the public offer');
assert.match(refundPolicy, /Last updated: August 31, 2026/, 'Refund policy must show the publication date of the new terms');
assert.match(refundPolicy, /You may request a full refund within 30 days of purchase\./, 'Refund policy must provide the approved 30-day full refund');
assert.match(refundPolicy, /After 30 days, any refund is the remaining balance after deducting \$5\.00 for each month of\s+service used from the \$30\.00 purchase price, to a minimum of \$0\.00\./, 'Refund policy must use the approved monthly calculation with a zero floor');
assert.match(refundPolicy, /To request help after a purchase, include the email used on the order\./, 'Refund help request must ask for the order email');
assert.match(refundPolicy, /Payment: Secure checkout via Creem — Alipay supported\./, 'Refund payment copy must use the approved Creem wording');
assert.match(contact, /support@openagent\.email/, 'Approved contact page must exist with approved support address');

// R3 P1: the public offer, terms, and refund policy must use the same one-time framing.
assert.doesNotMatch(homepage, /Hosted Pro starts at \$5\/month with a 3-day free trial/, 'Homepage FAQ must not advertise a monthly trial');
assert.doesNotMatch(homepage, /join the early-bird plan/i, 'Homepage CTA must not advertise the retired early-bird plan');
assert.match(homepage, /If you would rather not run a server, Hosted Pro Early Bird is now available for \$30\/year as a one-time payment — see our pricing\./, 'Homepage FAQ must state the public early-bird offer');
assert.match(homepage, /<a class="manual-link" href="\/pricing">No VPS\? Hosted Pro Early Bird is \$30\/year →<\/a>/, 'Homepage hero secondary must state the offer and still link /pricing');
assert.doesNotMatch(terms, /subscription basis|billed monthly or yearly|free 3-day trial|cancel anytime|paid period|subscription fees/i, 'Terms must not describe a retired subscription offer');
assert.match(terms, /Effective August 31, 2026/, 'Terms must show the publication date of the live annual offer');
assert.match(terms, /Hosted Pro Early Bird is a one-time \$30\.00 payment for one year, with no automatic renewal\./, 'Terms must state the one-time annual offer');
assert.match(terms, /Early Bird customers may renew for another year at the \$30\.00\/year Early Bird price\./, 'Terms must state the approved renewal terms');
assert.match(terms, /Refund Policy/, 'Terms must direct refund requests to the refund policy');

// Hosted Pro customer data and support disclosures must match the public offer.
const privacyCopy = normalizeWhitespace(privacy);
assert.match(privacyCopy, /Effective August 31, 2026/, 'Privacy policy must show the publication date of the new disclosure');
assert.doesNotMatch(privacyCopy, /collects no personal data|No accounts, no sign-ups, no forms that collect personal information|If you\s+subscribe/i, 'Privacy policy must not deny contact data or describe a subscription');
assert.match(privacyCopy, /<p class="lede"> The short version: when you self-host openagent\.email, your mail data stays on your server\. For Hosted Pro, we use customer and order information only to provide and support the service\. This website uses no tracking cookies\. <\/p>/, 'Privacy lede must state the Hosted Pro customer-data purpose');
assert.match(privacyCopy, /The Hosted Pro checkout collects the email address used for the order and the requested openagent\.email address prefix\. We use them to create, provision, and support your hosted instance\./, 'Privacy policy must disclose the checkout identity fields and their purpose');
assert.match(privacyCopy, /Creem is our Merchant of Record and payment processor\. It processes your payment and billing information under its own privacy policy; we never see or store your full card details\./, 'Privacy policy must identify Creem and its payment-data role');
assert.match(privacyCopy, /Hosted Pro customers can contact <a href="mailto:support@openagent\.email">support@openagent\.email<\/a>\. We use the address only to provide support and reply to the request\./, 'Privacy website disclosure must route support to the approved address');
assert.match(privacyCopy, /<h2>Hosted Pro<\/h2> <p> Our optional hosted service is for people who don't want to run their own server\. If you make a one-time purchase, the following applies: <\/p>/, 'Hosted Pro intro must exactly match the approved copy');
assert.doesNotMatch(`${pricing}\n${homepage}\n${privacy}\n${refundPolicy}`, /waitlist|public checkout is not open/i, 'Public offer pages must not retain waitlist or closed-checkout copy');
