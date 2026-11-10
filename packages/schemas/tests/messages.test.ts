import { describe, expect, it } from 'vitest';
import { messagePostSchema } from '../src/visit';

describe('messagePostSchema', () => {
  it('accepts a plain text message', () => {
    expect(
      messagePostSchema.safeParse({
        conversationId: 'conversation-1',
        body: 'Is it still available?',
      }).success,
    ).toBe(true);
  });

  it('rejects an empty text message', () => {
    expect(
      messagePostSchema.safeParse({
        conversationId: 'conversation-1',
        kind: 'text',
        body: '   ',
      }).success,
    ).toBe(false);
  });

  it('rejects an unknown message kind', () => {
    expect(
      messagePostSchema.safeParse({
        conversationId: 'conversation-1',
        kind: 'payment_request',
        body: 'Pay me',
      }).success,
    ).toBe(false);
  });

  it('requires a slot for a visit acceptance', () => {
    expect(
      messagePostSchema.safeParse({
        conversationId: 'conversation-1',
        kind: 'visit_accept',
      }).success,
    ).toBe(false);

    expect(
      messagePostSchema.safeParse({
        conversationId: 'conversation-1',
        kind: 'visit_accept',
        visit: { date: '2026-11-12', time: '17:30' },
      }).success,
    ).toBe(true);
  });
});
