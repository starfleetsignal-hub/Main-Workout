# TradeRunner

An automated day-trading app for stocks and crypto. It streams live prices and
real-time news, scores every symbol on your watchlist, and opens and closes
positions through your own brokerage account inside limits you set.

Built with [Expo](https://expo.dev) SDK 57 / React Native, so one codebase runs
on iOS, Android and the web. The same engine also runs headless on a server.

**The app is licensed.** It ships locked and refuses to do anything until it is
activated with a signed license key that only you can issue. See
[Selling it](#selling-it).

---

## What it does

- **Live market data.** Trade prints and one-minute bars stream over WebSocket
  for stocks (IEX or SIP) and crypto (24/7), with automatic reconnect and
  exponential backoff.
- **Real-time news, scored on device.** Every headline is scored for sentiment
  by a financial lexicon that handles negation and intensifiers. No text leaves
  the phone and no third-party AI service is involved.
- **A transparent entry model.** Each symbol gets a score out of 100 from six
  components. You can see the exact breakdown per symbol, including which rule
  is blocking a trade right now.
- **Managed exits.** Stop loss, take profit, trailing stop, max hold time,
  trend-break exit, a news veto, and a flatten before the closing bell.
- **Circuit breakers.** A daily loss limit that flattens everything and halts
  trading, plus a daily trade cap.
- **Paper mode first.** Paper and live are a single switch, and going live asks
  for explicit confirmation.

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
pre-close window, the daily loss halt, the trade cap, or news sentiment below
your veto level.

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

## Getting started

```bash
npm install
npm run license:keygen          # creates your signing key pair (once)
npm start                       # then press i, a or w
```

`license:keygen` writes `license-private.key` (secret) and puts the matching
public key in `.env`. Both are gitignored. Without a key pair, the app builds
but cannot be activated by anything, which is the intended default.

To use the app you need an [Alpaca](https://alpaca.markets) account. Generate
API keys in their dashboard, open **Settings → Connect Alpaca**, and paste them.
Keys are verified against the account endpoint before they are saved, and they
are stored in the device keychain via `expo-secure-store`, never in the bundle.

Start in **paper** mode. It is the default and costs nothing.

### Running the tests

```bash
npm test          # 61 tests: engine lifecycle, indicators, sentiment, licensing
npm run typecheck
```

The engine tests drive a fake broker and fake streams through entries, exits,
circuit breakers and reconciliation, with no network access.

### Running it headless

The same engine can run on a machine that stays awake:

```bash
export ALPACA_KEY_ID=... ALPACA_SECRET_KEY=... TRADERUNNER_LICENSE=TR1....
npm run headless -- --paper --symbols AAPL,NVDA,BTC/USD
```

It is gated by the same license check as the app.

---

## Selling it

The app is locked by an **Ed25519 signature**. Your private key signs license
keys; the app carries only the public key and verifies offline. Nobody can mint
a key that your builds accept without your private key, and a build made from
this source without your public key cannot be activated at all.

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

### Take the money

Either sell manually (take payment however you like, then issue a key and email
it), or run the optional fulfillment server, which turns a completed Stripe
Checkout into a key automatically and keeps a ledger of every sale:

```bash
npm run license:server
```

See [server/README.md](server/README.md) for the routes and environment.

### What the lock does and does not do

It does:

- Keep the entire trading interface unmounted until activation. The routes do
  not exist while locked, so deep links, saved navigation state and
  `router.push` cannot reach them.
- Reject forged, edited, expired and foreign-product keys offline, with no
  licensing server to go down.
- Re-lock automatically if a stored key is tampered with or expires.
- Tie every key to a buyer identity, which is shown in Settings. Keys that leak
  are traceable to whoever bought them.

It does not, and cannot, stop a determined attacker who controls the device from
patching the binary. That is true of every offline licensing scheme. What it
does stop is casual copying and key sharing, which is what actually costs sales.
If you need more, the usual next steps are server-side activation with a device
count, or shipping through the App Store and Play Store, where the store handles
entitlement for you.

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
2. Make sure `EXPO_PUBLIC_LICENSE_PUBLIC_KEY` is set in the build environment.
   EAS does not read `.env` by default — add it as a build secret, or the app
   you ship cannot be activated.
3. Decide how buyers pay. If you sell licenses to iOS users for use in the iOS
   app, Apple generally requires in-app purchase. Read the current App Store
   Review Guidelines on this point before submitting, since getting it wrong is
   the most common rejection for apps like this one. Selling a key on your own
   site for a Mac, web or Android build is a different question from selling one
   for the iOS build.

## Project layout

```
app/                      expo-router routes
  _layout.tsx             the license gate (Stack.Protected)
  activate.tsx            activation / sales screen
  connect.tsx             broker key entry
  (tabs)/                 Desk, Positions, News, Rules, Settings
  symbol/[id].tsx         per-symbol signal breakdown
src/
  engine/                 the trading engine — no React, no React Native
    engine.ts             lifecycle: signal → size → enter → manage → exit
    strategy.ts           the scoring model
    indicators.ts         EMA, RSI, VWAP, ATR
    sentiment.ts          on-device news sentiment
    parameters.ts         the rules, their bounds and presets
  broker/alpaca/          REST client and reconnecting WebSocket streams
  license/                key format and offline verification
  context/                React bindings for license, credentials and engine
  components/, theme/
tools/license/            keygen, issue, verify
tools/icons/              icon generation
server/fulfill.mjs        optional Stripe → license key server
headless/run.mjs          run the engine from a terminal
tests/                    61 tests, no network
```

The engine has no dependency on React or React Native, which is why it can be
tested under plain Node and run headless unchanged.

---

## Risk

TradeRunner places real orders with real money in your own brokerage account.

Automated trading can lose money faster than trading by hand. Stops are not
guarantees: gaps, halts, slippage, partial fills and connectivity loss all mean
you can be filled far from your intended price, or not at all. The engine
depends on your device and network staying up; if either fails while a position
is open, that position stays open and unmanaged until the app reconnects.

Pattern day-trading rules may apply to margin accounts under $25,000. Short
selling requires a margin account and carries unbounded loss.

This software is not financial advice, and nothing in it is a recommendation to
buy or sell any security. Run it in paper mode until you understand exactly what
it does. Use it at your own risk.

## License

The source in this repository is proprietary and not licensed for
redistribution. See [LICENSE](LICENSE).
