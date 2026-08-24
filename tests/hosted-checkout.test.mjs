import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pricing = await readFile(new URL('../src/pages/pricing.astro', import.meta.url), 'utf8');
const layout = await readFile(new URL('../src/layouts/Legal.astro', import.meta.url), 'utf8');
const refundPolicy = await readFile(new URL('../src/pages/refund-policy.astro', import.meta.url), 'utf8');
const contact = await readFile(new URL('../src/pages/contact.astro', import.meta.url), 'utf8');

const checkoutMatch = pricing.match(/href="(https:\/\/[^"\s]+\/checkout\/one-time\?product_id=prod_[^"\s]+)"/);
assert.ok(checkoutMatch, 'Hosted CTA must have an absolute checkout link');
const checkout = new URL(checkoutMatch[1]);
assert.equal(checkout.hostname, 'hosted.openagent.email', 'Hosted CTA must collect identity on the hosted checkout endpoint');
assert.equal(checkout.pathname, '/checkout/one-time', 'Hosted CTA must target the fixed one-time checkout endpoint');
assert.equal(checkout.searchParams.get('product_id'), 'prod_2MmEOwu9ph2BJA9JYpLjaB', 'Hosted CTA must bind the approved one-time product');
assert.doesNotMatch(pricing, /creem\.io\/payment\//, 'A static payment link cannot collect verified customer identity metadata');
assert.doesNotMatch(pricing, /waitlist/i, 'Hosted CTA must not be a waitlist');
assert.match(pricing, /Alipay is currently the available payment method/i, 'Hosted checkout copy must state the available method');
assert.doesNotMatch(pricing, /Apple Pay|credit card/i, 'Hosted checkout copy must not promise unavailable payment methods');
assert.match(layout, /href="\/refund-policy"/, 'Legal navigation must link the approved refund policy');
assert.match(layout, /href="\/contact"/, 'Legal navigation must link the approved contact page');
assert.match(refundPolicy, /Hosted openagent\.email is a one-time purchase\./, 'Approved refund policy page must exist with approved copy');
assert.match(contact, /support@openagent\.email/, 'Approved contact page must exist with approved support address');
