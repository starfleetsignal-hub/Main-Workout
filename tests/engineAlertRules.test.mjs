import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { computeEngineAlerts } = await import(pathToFileURL(path.join(root, 'dist-esm/notifications/engineAlertRules.js')).href);

function snap(overrides = {}) {
  return {
    status: 'running',
    statusDetail: '',
    trades: [],
    ...overrides,
  };
}

function trade(overrides = {}) {
  return {
    id: 't1',
    symbol: 'AAPL',
    pnl: -20,
    pnlPct: -0.008,
    exitReason: 'stop_loss',
    ...overrides,
  };
}

test('no alert when status is unchanged and there are no new trades', () => {
  const alerts = computeEngineAlerts('running', snap({ status: 'running' }), new Set());
  assert.deepEqual(alerts, []);
});

test('a transition to halted produces a "Trading halted" alert with the status detail', () => {
  const alerts = computeEngineAlerts(
    'running',
    snap({ status: 'halted', statusDetail: 'Daily loss limit hit (2%). Flattening and halting.' }),
    new Set()
  );
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, 'Trading halted');
  assert.equal(alerts[0].body, 'Daily loss limit hit (2%). Flattening and halting.');
});

test('a transition to halted with no status detail falls back to a default message', () => {
  const alerts = computeEngineAlerts('running', snap({ status: 'halted', statusDetail: '' }), new Set());
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].body, 'Daily loss limit reached.');
});

test('a transition to error produces an "Engine error" alert', () => {
  const alerts = computeEngineAlerts('running', snap({ status: 'error', statusDetail: 'broker rejected the order' }), new Set());
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, 'Engine error');
  assert.equal(alerts[0].body, 'broker rejected the order');
});

test('no alert when the status stays halted across snapshots (edge-triggered only)', () => {
  const alerts = computeEngineAlerts('halted', snap({ status: 'halted', statusDetail: 'still halted' }), new Set());
  assert.deepEqual(alerts, []);
});

test('an unseen stop-loss trade produces a formatted alert', () => {
  const t = trade({ id: 'tx1', symbol: 'AAPL', pnl: -34.5, pnlPct: -0.0123 });
  const alerts = computeEngineAlerts('running', snap({ trades: [t] }), new Set());
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].title, 'AAPL stopped out');
  assert.equal(alerts[0].body, 'Closed on a stop loss: -34.50 (-1.23%)');
});

test('a take-profit or manual exit does not produce an alert', () => {
  const alerts = computeEngineAlerts(
    'running',
    snap({ trades: [trade({ id: 'tx2', exitReason: 'take_profit' }), trade({ id: 'tx3', exitReason: 'manual' })] }),
    new Set()
  );
  assert.deepEqual(alerts, []);
});

test('a trade already in the seen set is not re-alerted', () => {
  const t = trade({ id: 'tx1' });
  const alerts = computeEngineAlerts('running', snap({ trades: [t] }), new Set(['tx1']));
  assert.deepEqual(alerts, []);
});

test('multiple new stop-loss trades each produce their own alert', () => {
  const alerts = computeEngineAlerts(
    'running',
    snap({ trades: [trade({ id: 'tx1', symbol: 'AAPL' }), trade({ id: 'tx2', symbol: 'MSFT' })] }),
    new Set()
  );
  assert.equal(alerts.length, 2);
  assert.deepEqual(
    alerts.map((a) => a.title),
    ['AAPL stopped out', 'MSFT stopped out']
  );
});

test('a status alert and a new stop-loss trade in the same snapshot both fire', () => {
  const alerts = computeEngineAlerts(
    'running',
    snap({ status: 'halted', statusDetail: 'halted', trades: [trade({ id: 'tx1' })] }),
    new Set()
  );
  assert.equal(alerts.length, 2);
  assert.equal(alerts[0].title, 'Trading halted');
  assert.equal(alerts[1].title, 'AAPL stopped out');
});
