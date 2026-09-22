# License delivery server (optional)

`fulfill.mjs` is a tiny zero-dependency Node server that turns a completed
Stripe Checkout payment into a license key. You only need it if you want
buyers to get their key automatically. Selling manually works fine too:
take the payment however you like, then run

```bash
npm run license:issue -- --sub "buyer@example.com" --plan lifetime
```

and email them the key.

## What it does

| Route | Purpose |
| --- | --- |
| `POST /webhook` | Stripe `checkout.session.completed` webhook. Verifies the Stripe signature, issues a key, stores it, and (optionally) emails it. |
| `GET /claim?session_id=cs_test_...` | The page Stripe redirects to after payment. Shows the buyer their key. |
| `GET /license?session_id=...` | JSON version of the same, for the in-app "I've paid" flow. |
| `GET /health` | Liveness check. |

Keys are stored as newline-delimited JSON in `--store` (default
`licenses.jsonl`), so the file doubles as your sales ledger.

## Running it

```bash
export LICENSE_PRIVATE_KEY_PEM="$(cat license-private.key)"   # or leave the file in cwd
export STRIPE_SECRET_KEY=sk_live_...
export STRIPE_WEBHOOK_SECRET=whsec_...
export LICENSE_PLAN=lifetime          # lifetime | annual | monthly
node server/fulfill.mjs --port 8787
```

Point your Stripe webhook at `https://your-host/webhook` and set the
Checkout success URL to `https://your-host/claim?session_id={CHECKOUT_SESSION_ID}`.

The private key never leaves this server, and the server never needs your
app's source. Deploy it anywhere that runs Node 18+.

## Signature verification

The webhook checks Stripe's `Stripe-Signature` header with an HMAC-SHA256
over `"<timestamp>.<raw body>"` and rejects anything older than five minutes,
which is Stripe's documented scheme. Unsigned or stale requests are refused,
so nobody can mint themselves a key by POSTing to the endpoint.
