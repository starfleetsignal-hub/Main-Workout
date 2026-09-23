# TradeRunner

An automated day-trading app for stocks and crypto. It streams live prices and
real-time news, scores every symbol on your watchlist, and opens and closes
positions through an account you already own inside limits you set.

Built with [Expo](https://expo.dev) SDK 57 / React Native, so one codebase runs
on iOS, Android and the web. The same engine also runs headless on a server.

**The app is licensed.** It ships locked and refuses to do anything until it is
activated with a signed license key that only you can issue, optionally backed
by a device-counting activation server. See [Selling it](#selling-it).

---

## What it does

- **Five venues.** Alpaca (stocks and crypto, verified live), Coinbase Advanced
  Trade, Robinhood Crypto, Uphold and a self-custody Solana wallet through
  Jupiter. One connect screen, generated from each venue's declared
  capabilities. See [Venues](#venues) for what each one can and cannot do.
- **Live market data.** Trade prints and one-minute bars stream over WebSocket
  where a venue offers one; venues without a push feed (Robinhood, Uphold,
  Jupiter) are polled and folded into bars locally, with automatic reconnect
  and exponential backoff on the streaming venues.
- **Real-time news, scored on device.** Every headline is scored for sentiment
  by a financial lexicon that handles negation and intensifiers. No text leaves
  the phone and no third-party AI service is involved. Venues with no news feed
  score that component neutral rather than guessing.
- **A transparent entry model.** Each symbol gets a score out of 100 from six
  components. You can see the exact breakdown per symbol, including which rule
  is blocking a trade right now.
- **Managed exits.** Stop loss, take profit, trailing stop, max hold time,
  trend-break exit, a news veto, and a flatten before the closing bell.
- **Circuit breakers.** A daily loss limit that flattens everything and halts
  trading, plus a daily trade cap. On venues with no prior-day equity mark, the
  baseline is the equity the engine first saw this session.
- **Portfolio-level guardrails.** A cap on combined exposure per asset class
  (independent of the per-position size cap), and a slippage guard that cools a
  symbol down after a fill lands far from where it was sized.
- **Performance tracking.** An equity curve and drawdown/win-rate/profit-factor
  stats, computed from the same trade log the engine already keeps, shown on
  the Positions tab.
- **A backtesting harness.** Replays historical bars through the real engine —
  the same `TradingEngine` class, not a reimplementation — to produce a trade
  list and performance stats before you risk anything live. See
  [Backtesting](#backtesting).
- **A remote kill switch.** An optional admin command that flattens every
  device on a license on its next check-in, for when you need to step in from
  outside the app.
- **Local alerts and a crash log.** Opt-in local notifications for a halt, an
  engine error, a remote flatten, or a stop-loss exit, plus a small on-device
  error log — no third-party crash reporting service, nothing leaves the
  device. See Settings → Notifications / Diagnostics.
- **A one-time risk acknowledgment gate** before the trading UI is reachable at
  all, independent of the license gate.
- **Paper mode first**, where the venue offers one. Paper and live are a single
  switch, and going live asks for explicit confirmation.

### Venues

| Venue | Assets | Paper mode | Feed | News | Shorts | Status |
| --- | --- | --- | --- | --- | --- | --- |
| **Alpaca** | Stocks + crypto | Yes | Streaming | Yes | Yes | Tested live |
| **Coinbase** | Crypto | No | Streaming | No | No | Untested |
| **Robinhood Crypto** | Crypto | No | Polled | No | No | Untested |
| **Uphold** | Crypto | Sandbox | Polled | No | No | Untested |
| **Jupiter (Solana)** | Crypto | No | Polled | No | No | Experimental, self-custody |

Only Alpaca has been run against a live account from this codebase. The others
are written to each venue's published API and covered by request-signing and
response-mapping tests against a mocked network — real, but not the same thing
as a live fill. The in-app venue picker states this plainly before you connect,
and Jupiter carries an extra warning: it is self-custody, the app holds your
wallet's private key on-device, and swaps are irreversible with no broker to
call if something goes wrong.

### How a trade is decided

| Component | Max | What it measures |
| --- | ---: | --- |
| VWAP | 20 | Price on the correct side of session VWAP, and by how much |
| EMA 9/21 | 20 | Fast EMA aligned with the trade direction |
| Fresh cross | 10 | An EMA crossover in the last three bars, so it is not chasing |
| RSI | 15 | Momentum inside your band, penalised when overbought |
| Volume | 15 | Last bar's volume against its 20-bar average |
| News | 20 | Aggregate sentiment over your lookback window |

A position is opened only when the total clears your minimum score **and** no
veto applies. Vetoes are absolute and independent of the score: a per-symbol
cooldown, a stale price feed, a closed market, the opening minutes, the
pre-close window, the daily loss halt, the trade cap, a venue that cannot sell
short, or news sentiment below your veto level.

Position size is derived from risk, not from a fixed share count: the quantity
is set so that being stopped out costs approximately your configured percentage
of equity, then capped by the maximum position size and by available buying
power.

### What it is not

It is not a prediction engine and it makes no promise of profit. It automates a
rule set that a discretionary day trader might follow, and it follows those
rules consistently. Whether that set of rules makes money in any given market is
not something this or any other software can guarantee.

---

## Backtesting

```bash
npm run backtest -- --bars-file path/to/your-bars.json   # {"AAPL":[{"t":...,"o":...,"h":...,"l":...,"c":...,"v":...}]}
npm run backtest -- --symbols AAPL,BTC/USD --key-id $ALPACA_KEY_ID --secret-key $ALPACA_SECRET_KEY
```

The harness (`backtest/harness.mjs`) builds the real `TradingEngine` with a
fake broker and fake streams backed by pre-loaded bars — the exact pattern the
engine test suite uses — then replays them bar by bar, driving indicators,
entries, exits, sizing and the daily-loss halt exactly as a live run would.
It prints total return, max drawdown, win rate, profit factor and the full
trade list.

Known v1 limits, so you don't mistake them for bugs: no historical news is
simulated (the news component scores neutral, the same path a venue with no
news feed already takes); exits are checked once per bar at its close, not by
scanning the bar's high/low; shorting and margin are not modeled (long-only,
cash-account sizing); and the Alpaca fetch path pulls the most recent `--limit`
bars, not an arbitrary historical date range. See the comment at the top of
`backtest/harness.mjs` for the full list.

---

## Getting started

```bash
npm install
npm run license:keygen          # creates your signing key pair (once)
npm start                       # then press i, a or w
```

`license:keygen` writes `license-private.key` (secret) and puts the matching
public key in `.env`. Both are gitignored. Without a key pair, the app builds
but cannot be activated by anything, which is the intended default.

Open **Settings → Choose a venue**, pick where you already have an account, and
paste that venue's API keys. Keys are verified against the venue before they
are saved, and are stored in the device keychain via `expo-secure-store`, never
in the bundle. Start in paper mode where the venue offers one.

### Running the tests

```bash
npm test          # 177 tests: engine, analytics, backtesting, indicators, sentiment,
                   # venues, licensing, activation, the headless control server, alerts
npm run typecheck
```

The engine tests drive a fake broker and fake streams through entries, exits,
circuit breakers and reconciliation, with no network access. The venue adapters
are tested against a mocked `fetch` that pins each request's shape to the
venue's published API and checks the response mapping. The activation tests
boot the real activation server as a child process and exercise seat limits,
revocation and restarts against it directly, rather than mocking it. The
backtesting harness is tested against deterministic synthetic bar fixtures
(a sustained uptrend, a flat market, a scripted stop-loss reversal).

`.github/workflows/ci.yml` runs typecheck, the full test suite, and a web
bundle export on every push to this branch and every pull request.

### Running it headless

The same engine can run on a machine that stays awake:

```bash
export ALPACA_KEY_ID=... ALPACA_SECRET_KEY=... TRADERUNNER_LICENSE=TR1....
npm run headless -- --paper --symbols AAPL,NVDA,BTC/USD
```

For any other venue, point it at a credentials file instead (same shape as
the app's own credential object — see each venue's descriptor in
`src/broker/registry.ts` for its exact fields):

```bash
echo '{"venue":"jupiter","privateKey":"...","rpcUrl":"...","slippageBps":"50"}' > jupiter-creds.json
npm run headless -- --creds-file jupiter-creds.json --symbols SOL/USDC
```

`*-creds.json` is gitignored, but treat it like any other live private key —
delete it when you're done, don't leave it lying around.

This is not just a convenience for a machine that stays on: **some venue
APIs (Jupiter's quote API among them) do not send CORS headers, so a browser
refuses to let the web build call them at all** — every request is blocked
before it leaves the tab, visible in DevTools → Network as "CORS Failed."
That is a browser-only restriction with no client-side fix; Node's `fetch`
does not enforce CORS, so the exact same code works from here (and would
work the same way from a native iOS/Android build, which also doesn't
enforce it).

It is gated by the same license check as the app. Add `--control-port` and
`--control-token` (or `CONTROL_PORT`/`CONTROL_TOKEN`) to run a small local
HTTP control server (`headless/control-server.mjs`) alongside it —
`GET /status`, `POST /flatten`, `POST /stop?flatten=1`, all bearer-token
gated — for scripting a kill switch into your own tooling.

The same server also serves a plain-HTML **visual monitor** at `GET /` —
no build step, no CORS problem (it's your own machine talking to itself over
`127.0.0.1`). Start the runner with a port and a token:

```
npm run headless -- --creds-file jupiter-creds.json --symbols SOL/USDC \
  --params crypto-starter-params.json --live \
  --control-port 4477 --control-token <make up a long random string>
```

then open `http://127.0.0.1:4477/` in a browser and paste in the same
control token when it asks (it's saved in that browser only, never sent
anywhere but this local server). The page shows equity, cash, open
positions with live unrealized P&L, recent activity and closed trades, and
refreshes every few seconds — plus the same flatten/stop buttons as the
API, with a confirmation prompt before either fires.

---

## Selling it

The app is locked by an **Ed25519 signature**. Your private key signs license
keys; the app carries only the public key and verifies offline. Nobody can mint
a key that your builds accept without your private key, and a build made from
this source without your public key cannot be activated at all. This offline
check is the foundation — everything below is optional and layers on top of it.

### Issue a key

```bash
npm run license:issue -- --sub "buyer@example.com" --plan lifetime
npm run license:issue -- --sub "buyer@example.com" --plan annual
npm run license:issue -- --sub "Reviewer" --plan trial --days 7
npm run license:issue -- --sub "bulk" --count 20 --json --log licenses.csv
```

Plans are `lifetime` (no expiry), `annual`, `monthly` and `trial`. Expiry is
carried inside the signed payload, so it cannot be edited by the holder — the
app re-checks it on launch and every minute while running, and re-locks itself
the moment a license lapses.

To check a key from a support ticket:

```bash
npm run license:verify -- "TR1.…"
```

### Server-side activation (optional)

Signing keys stops forgery, but it cannot count devices or take a key back once
it is sold. `server/activation.mjs` adds both:

```bash
export ADMIN_TOKEN=$(openssl rand -hex 24)
npm run license:server:activation -- --seats 3
```

Set `EXPO_PUBLIC_ACTIVATION_URL` to the server's base URL and rebuild, and the
app registers each device against its license and shows the seat count in
Settings. The design goal is that your server being down never strands a
paying customer:

- **Activation is a lease, not a gate check.** Each successful check-in returns
  a signed, expiring lease (72 hours by default). The app keeps trading on that
  lease until it is roughly half-expired, then quietly renews in the
  background.
- **Network failure is not a refusal.** If the server cannot be reached, the
  app keeps working on its last lease through a configurable grace window
  (`EXPO_PUBLIC_ACTIVATION_GRACE_HOURS`, 14 days by default) and shows a small
  notice rather than locking.
- **Only a definite "no" locks immediately**: a revoked license, or the seat
  limit being hit on a new device. Everything else fails open.

Admin routes (behind `ADMIN_TOKEN`) let you look up a license's devices, raise
its seat limit, revoke or restore it, and remotely flatten every device on a
license the next time each one checks in:

```bash
curl -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:8788/admin/licenses
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"licenseId":"...","reason":"refunded"}' http://localhost:8788/admin/revoke
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  -d '{"licenseId":"...","reason":"emergency stop"}' http://localhost:8788/admin/flatten
```

A pending flatten is broadcast to every device that checks in (not cleared by
the first one that sees it — `POST /admin/flatten-clear` clears it explicitly),
and closing everything is idempotent, so it is a no-op on a device with nothing
open.

The ledger is an append-only JSON-lines file (`activations.jsonl` by default),
so seats, revocations and limit changes all survive a restart.

### Take the money

Either sell manually (take payment however you like, then issue a key and email
it), or run the optional fulfillment server, which turns a completed Stripe
Checkout into a key automatically and keeps a ledger of every sale:

```bash
npm run license:server
```

See [server/README.md](server/README.md) for the routes and environment. It is
a separate process from the activation server above — run one, both, or
neither.

### What the lock does and does not do

It does:

- Keep the entire trading interface unmounted until activation. The routes do
  not exist while locked, so deep links, saved navigation state and
  `router.push` cannot reach them.
- Reject forged, edited, expired and foreign-product keys offline, with no
  licensing server required.
- Re-lock automatically if a stored key is tampered with or expires.
- Tie every key to a buyer identity, which is shown in Settings. Keys that leak
  are traceable to whoever bought them.
- With activation enabled, cap how many devices one key can be active on at
  once, and let you revoke a key after a refund or a chargeback.

It does not, and cannot, stop a determined attacker who controls the device from
patching the binary. That is true of every licensing scheme, offline or
server-backed. What it does stop is casual copying and key sharing, which is
what actually costs sales. If you need more than device-count enforcement, the
usual next step is shipping through the App Store and Play Store, where the
store handles entitlement for you.

**Keep `license-private.key` backed up.** Losing it means you can no longer
issue keys that existing builds accept.

---

## Shipping to the stores

```bash
npm install -g eas-cli && eas login
eas build --platform all --profile production
eas submit --platform ios
```

Before you do:

1. Set your real `ios.bundleIdentifier` and `android.package` in `app.json`
   (currently `com.traderunner.app`).
2. Make sure `EXPO_PUBLIC_LICENSE_PUBLIC_KEY` (and `EXPO_PUBLIC_ACTIVATION_URL`
   if you run the activation server) are set in the build environment. EAS does
   not read `.env` by default — add them as build secrets, or the app you ship
   cannot be activated.
3. Decide how buyers pay. If you sell licenses to iOS users for use in the iOS
   app, Apple generally requires in-app purchase. Read the current App Store
   Review Guidelines on this point before submitting, since getting it wrong is
   the most common rejection for apps like this one. Selling a key on your own
   site for a Mac, web or Android build is a different question from selling one
   for the iOS build.
4. Fill in `legal/PRIVACY.md` and `legal/TERMS.md`, host them somewhere public,
   and set `EXPO_PUBLIC_PRIVACY_POLICY_URL` / `EXPO_PUBLIC_TERMS_URL` as build
   secrets. Both stores require a privacy policy URL before you can submit —
   the templates are written to match what this codebase actually collects,
   but they are not legal advice and a real trading app should have a lawyer
   look them over.
5. Run `eas init` once to attach the project to your own Expo account (this
   writes `extra.eas.projectId` into `app.json`); `eas build`/`eas submit`
   do not work without it. `eas.json` already has `development`, `preview` and
   `production` build profiles.
6. Expect Apple's age rating and financial-app review questions — a real-money
   automated trading app is treated more carefully than an average utility
   app, and reviewers may ask for a demo account or additional detail.

## Project layout

```
app/                      expo-router routes
  _layout.tsx             the error boundary, license gate + risk gate (Stack.Protected), navigation theme
  activate.tsx            activation / sales screen
  risk-ack.tsx            one-time risk acknowledgment, gated independently of the license
  venues.tsx              the venue picker
  connect.tsx             one connect screen, driven by the venue descriptor
  (tabs)/                 Desk, Positions (equity curve + stats), News, Rules, Settings
  symbol/[id].tsx         per-symbol signal breakdown
src/
  engine/                 the trading engine — no React, no React Native
    engine.ts             lifecycle: signal → size → enter → manage → exit
    strategy.ts           the scoring model
    indicators.ts         EMA, RSI, VWAP, ATR
    sentiment.ts          on-device news sentiment
    parameters.ts         the rules, their bounds and presets
    analytics.ts          drawdown / win-rate / profit-factor stats from the trade log
  broker/
    venues.ts             venue capability model + descriptors
    registry.ts           wires a venue id to its broker + stream implementation
    signing.ts            Ed25519 / ES256 request signing shared by the adapters
    polling.ts            synthesises ticks/bars for venues with no push feed
    alpaca/, coinbase/, robinhood/, uphold/, jupiter/
  license/
    format.ts             key format and offline verification
    activation.ts          seat/lease client logic, the unlock decision, remote flatten
    device.ts             per-install device id, never a hardware identifier
    publicKey.ts           build-time config: keys, purchase/privacy/terms URLs
  notifications/          local trade alerts (halt, error, remote flatten, stop-loss)
  errors/                 the root error boundary + on-device crash log
  context/                React bindings for license, risk, notifications, credentials, engine
  components/, theme/     the CosmoPlan visual system (starfield, coin marks, Fredoka)
backtest/harness.mjs      replays historical bars through the real TradingEngine
tools/backtest.mjs        backtest CLI: a local bars file, or a recent pull from Alpaca
tools/license/            keygen, issue, verify
tools/icons/               app icon generation
server/
  fulfill.mjs             optional Stripe → license key server
  activation.mjs          optional seat-counting / revocation / remote-flatten server
headless/
  run.mjs                 run the engine from a terminal
  control-server.mjs      optional local HTTP kill switch for the headless runner
legal/                    privacy policy / terms of use templates to fill in before shipping
.github/workflows/ci.yml  typecheck, build, test and a web-bundle sanity check
tests/                    177 tests, no network except the activation server's own child process
```

The engine has no dependency on React or React Native, which is why it can be
tested under plain Node and run headless unchanged. Every broker adapter
implements the same `Broker` interface, so the engine does not know or care
which venue it is talking to.

---

## Risk

TradeRunner places real orders with real money in an account you already own.

Automated trading can lose money faster than trading by hand. Stops are not
guarantees: gaps, halts, slippage, partial fills and connectivity loss all mean
you can be filled far from your intended price, or not at all. The engine
depends on your device and network staying up; if either fails while a position
is open, that position stays open and unmanaged until the app reconnects.

On venues with no paper mode, every order from the first run is real. On the
Jupiter (Solana) adapter, assets are held in a wallet you control rather than
by a custodian: swaps are irreversible on-chain, failed transactions can still
cost network fees, and there is no broker to call if something goes wrong.

Pattern day-trading rules may apply to margin accounts under $25,000. Short
selling is available on Alpaca only, requires a margin account, and carries
unbounded loss.

This software is not financial advice, and nothing in it is a recommendation to
buy or sell any asset. Run it in paper mode where available, and size your
first runs small everywhere else, until you understand exactly what it does.
Use it at your own risk.

The app makes you acknowledge this once, explicitly, before the trading UI is
reachable at all (`app/risk-ack.tsx`) — independent of, and in addition to, the
license gate. Local trade alerts and the on-device crash log are a convenience,
not a safety net: they only fire while the app's JS process is alive, which is
the same condition under which the engine manages a position at all.

## License

The source in this repository is proprietary and not licensed for
redistribution. See [LICENSE](LICENSE).
