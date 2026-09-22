/**
 * The Ed25519 public key that license keys are verified against.
 *
 * It is injected at build time from the EXPO_PUBLIC_LICENSE_PUBLIC_KEY
 * environment variable (see `.env.example` and `npm run license:keygen`),
 * so the repository never contains a key pair and every build you ship is
 * bound to YOUR private key. Anyone who rebuilds the app without it gets a
 * build that cannot be activated at all.
 */
export const LICENSE_PUBLIC_KEY_HEX: string = (process.env.EXPO_PUBLIC_LICENSE_PUBLIC_KEY ?? '').trim();

/** Where users go to buy a key. Also injected at build time. */
export const PURCHASE_URL: string = (process.env.EXPO_PUBLIC_PURCHASE_URL ?? '').trim();
