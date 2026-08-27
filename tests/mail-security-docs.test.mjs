import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dnsSetup = await readFile(new URL('../src/content/docs/docs/guides/dns-setup.md', import.meta.url), 'utf8');
const quickstart = await readFile(new URL('../src/content/docs/docs/quickstart.md', import.meta.url), 'utf8');

const stagedDmarcGuidance = 'Start with `p=quarantine`. For the first observation week, you may use `p=none`. After `doctor.sh` is green, move to `p=reject`.';

test('DNS setup documents the exact staged DMARC policy', () => {
  assert.match(dnsSetup, /_dmarc\.example\.com\.\s+TXT\s+"v=DMARC1; p=quarantine; rua=mailto:postmaster@example\.com"/);
  assert.equal(dnsSetup.includes(stagedDmarcGuidance), true);
});

test('quickstart launch checklist requires the mail-security trio and doctor', () => {
  assert.equal(
    quickstart.includes('Before launch, verify the mail-security trio SPF, DKIM, and DMARC with `./deploy/doctor.sh`.'),
    true,
  );
});
