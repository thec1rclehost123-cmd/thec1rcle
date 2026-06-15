import test from 'node:test';
import assert from 'node:assert/strict';

import { generateICSBuffer, generateICSContent } from '../../../lib/email/generateICS.js';

const sampleInvite = {
  eventName: 'Summer Social, Rooftop Edition',
  startDate: '2026-06-01',
  endDate: '2026-06-02',
  startTime: '19:30',
  endTime: '00:30',
  location: 'Club, Downtown; Terrace',
  description: 'Line 1\nLine 2',
  eventUrl: 'https://guest.thec1rcle.com/event/summer-social',
  organizer: 'THE C1RCLE',
  orderId: 'order-123',
};

test('generateICSContent creates a valid ICS payload with escaped fields and event metadata', () => {
  const content = generateICSContent(sampleInvite);

  assert.match(content, /^BEGIN:VCALENDAR/m);
  assert.match(content, /^BEGIN:VEVENT/m);
  assert.match(content, /^UID:order-123@thec1rcle\.com$/m);
  assert.match(content, /^SUMMARY:Summer Social\\, Rooftop Edition$/m);
  assert.match(content, /^LOCATION:Club\\, Downtown\\; Terrace$/m);
  assert.match(
    content,
    /^DESCRIPTION:Line 1\\nLine 2\\n\\nView event: https:\/\/guest\.thec1rcle\.com\/event\/summer-social$/m,
  );
  assert.match(content, /^URL:https:\/\/guest\.thec1rcle\.com\/event\/summer-social$/m);
  assert.match(content, /^BEGIN:VALARM$/m);
  assert.match(content, /^END:VCALENDAR$/m);
});

test('generateICSBuffer returns a utf-8 buffer for the generated content', () => {
  const buffer = generateICSBuffer(sampleInvite);

  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.toString('utf8'), generateICSContent(sampleInvite));
});
