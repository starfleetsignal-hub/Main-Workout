# Privacy Policy

**Template — fill in the bracketed placeholders, host this page somewhere public, then
point `EXPO_PUBLIC_PRIVACY_POLICY_URL` at it before you submit to a store.**
It is written to match what TradeRunner actually does as of this version; if you
change what the app collects or where data goes, update this document to match
before you rely on it.

Effective date: [DATE]

[YOUR NAME OR COMPANY], the operator of TradeRunner ("we", "us"), publishes this
policy to explain what data the app collects, why, and where it goes. Contact:
[SUPPORT EMAIL].

## What TradeRunner stores, and where

Everything below is stored **on the device**, in the OS keychain/keystore
(`expo-secure-store`) or local app storage (`AsyncStorage`). None of it is
copied to a server we operate, because we don't run one that the app talks to
by default.

| Data | Where | Leaves the device? |
|---|---|---|
| Your venue API keys / secrets (Alpaca, Coinbase, Robinhood, Uphold, Jupiter wallet key) | OS keychain/keystore | Only to that venue's own API, to place and manage orders on your behalf |
| Your license key | OS keychain/keystore | Only to the activation server, if you run one (see below) |
| A random per-install device id (not a hardware identifier) | OS keychain/keystore | Only to the activation server, if you run one, to count seats |
| Trading parameters, watchlist, trade history, equity curve | Local app storage | No |
| A short on-device error/crash log | Local app storage | No |
| Notification preference | Local app storage | No |

## Optional server-side activation

If this build points at an activation server (`EXPO_PUBLIC_ACTIVATION_URL`), the
app periodically sends your license key and the random device id above to that
server, and receives back whether the license is still valid and how many
devices are using it. That server is operated by [YOU / YOUR COMPANY] at
[SERVER LOCATION / HOST], and its own retention of that data is: [DESCRIBE —
e.g. "activation records are kept for the life of the license, and are deleted
on request"].

If no activation server is configured, license checks happen entirely offline
on the device and nothing about your license is transmitted anywhere.

## What we do not do

- No analytics or usage tracking SDKs are included.
- No advertising identifiers are read or requested.
- News sentiment scoring runs on-device; no article text or trading activity
  is sent to a third-party AI or analytics service to produce it.
- We do not sell or share your data, because we do not collect it.

## Third parties you connect directly

When you add a venue (Alpaca, Coinbase, Robinhood, Uphold, or a Jupiter
wallet), the app talks **directly** to that venue's own API using the keys you
provide. That venue's own privacy policy governs what happens to your data
once it reaches them — this policy only covers TradeRunner itself. Read the
respective venue's policy before connecting an account.

## Crash and error records

If the app hits an unexpected error, a short record (an error message, a stack
trace, and roughly when it happened) is saved on the device so you can see it
under Settings → Diagnostics. It is not transmitted anywhere automatically. If
you contact support and choose to share one of these records with us, that is
your choice, not something the app does on its own.

## Notifications

If you turn on trade alerts, the OS notification permission you grant is used
only to show local notifications generated on the device (a halt, an error, a
stop-loss exit). No push token is registered with us or any third party for
this feature — these are local notifications, not remote push.

## Children

TradeRunner is a financial trading tool and is not directed at, or intended
for use by, children. [ADD YOUR STORE-REQUIRED AGE RATING / COPPA STATEMENT
HERE IF APPLICABLE.]

## Changes to this policy

[DESCRIBE HOW YOU WILL NOTIFY USERS OF CHANGES — e.g. "the effective date
above will be updated, and material changes will be noted in the app's
release notes."]

## Contact

[SUPPORT EMAIL / ADDRESS]
