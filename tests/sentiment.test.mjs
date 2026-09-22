import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { scoreSentiment, aggregateNews } = await import(path.join(root, 'dist-esm/engine/sentiment.js'));

test('clearly bullish copy scores positive', () => {
  const r = scoreSentiment('Nvidia beats estimates and raises guidance; shares surge to a record high');
  assert.ok(r.score > 0.4, `expected a strongly positive score, got ${r.score}`);
  assert.ok(r.confidence > 0.5);
});

test('clearly bearish copy scores negative', () => {
  const r = scoreSentiment('Shares plunge after the company misses badly and warns of mounting losses');
  assert.ok(r.score < -0.4, `expected a strongly negative score, got ${r.score}`);
});

test('neutral copy scores near zero with no confidence', () => {
  const r = scoreSentiment('The company will hold its annual meeting on Tuesday at its headquarters');
  assert.equal(r.score, 0);
  assert.equal(r.confidence, 0);
});

test('scores stay inside the -1..1 range', () => {
  const piledOn = 'surge soar beat upgrade rally jump record profit gains boost approval wins breakout exceeds'.repeat(5);
  const r = scoreSentiment(piledOn);
  assert.ok(r.score <= 1 && r.score > 0.9);
  const bad = 'plunge crash fraud bankruptcy lawsuit downgrade halt losses warns probe'.repeat(5);
  assert.ok(scoreSentiment(bad).score >= -1);
});

test('negation flips the sign', () => {
  const plain = scoreSentiment('The company beat expectations');
  const negated = scoreSentiment('The company did not beat expectations');
  assert.ok(plain.score > 0);
  assert.ok(negated.score < 0, `expected negation to flip the score, got ${negated.score}`);
});

test('intensifiers strengthen the reading', () => {
  const mild = scoreSentiment('Shares rose as profit gains continued');
  const strong = scoreSentiment('Shares rose as massive profit gains continued');
  assert.ok(strong.score >= mild.score);
});

test('a percentage move amplifies direction words', () => {
  const small = scoreSentiment('Shares up 1%');
  const large = scoreSentiment('Shares up 20%');
  assert.ok(large.score > small.score, `${large.score} should exceed ${small.score}`);
});

test('aggregateNews weights recent items more heavily', () => {
  const now = Date.now();
  const score = aggregateNews(
    [
      { createdAt: now - 1000, sentiment: 1, confidence: 1 },
      { createdAt: now - 80 * 60_000, sentiment: -1, confidence: 1 },
    ],
    now,
    90
  );
  assert.ok(score > 0, `the fresh positive item should dominate, got ${score}`);
});

test('aggregateNews ignores items outside the window', () => {
  const now = Date.now();
  assert.equal(aggregateNews([{ createdAt: now - 5 * 60 * 60_000, sentiment: -1, confidence: 1 }], now, 60), 0);
});

test('aggregateNews returns zero with no items', () => {
  assert.equal(aggregateNews([], Date.now(), 60), 0);
});

test('low-confidence items move the aggregate less than high-confidence ones', () => {
  const now = Date.now();
  const weak = aggregateNews([{ createdAt: now, sentiment: 1, confidence: 0 }, { createdAt: now, sentiment: -1, confidence: 1 }], now, 60);
  assert.ok(weak < 0, 'the confident negative item should win');
});
