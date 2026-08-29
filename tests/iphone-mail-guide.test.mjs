import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const guide = await readFile(new URL('../src/content/docs/docs/guides/iphone-mail.md', import.meta.url), 'utf8');

test('iPhone guide documents the real catch-all login model', () => {
  assert.match(guide, /catch-all mailbox/);
  assert.match(guide, /MAIL_PASSWORD/);
  assert.match(guide, /`993`/);
  assert.match(guide, /`465`/);
});

test('iPhone guide requires a publicly trusted certificate first', () => {
  assert.match(guide, /self-signed/i);
  assert.match(guide, /Let's Encrypt/);
});

test('iPhone guide documents the three iOS pitfalls', () => {
  assert.match(guide, /full email address/);
  assert.match(guide, /IMAP Path Prefix/);
  assert.match(guide, /Force-quit Mail/);
});
