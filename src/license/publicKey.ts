/**
 * Build-time configuration for licensing.
 *
 * These are injected from environment variables at build time (see
 * `.env.example` and `npm run license:keygen`), so the repository never
 * contains a key pair and every build you ship is bound to YOUR private key.
 * A build made without the public key cannot be activated at all.
 */
export const LICENSE_PUBLIC_KEY_HEX: string = (process.env.EXPO_PUBLIC_LICENSE_PUBLIC_KEY ?? '').trim();

/** Where users go to buy a key. Empty hides the purchase button. */
export const PURCHASE_URL: string = (process.env.EXPO_PUBLIC_PURCHASE_URL ?? '').trim();

/**
 * Hosted privacy policy / terms of use, required by the app stores before you
 * can submit. Empty hides the links — see legal/PRIVACY.md and legal/TERMS.md
 * for templates to fill in and host before you set these.
 */
export const PRIVACY_POLICY_URL: string = (process.env.EXPO_PUBLIC_PRIVACY_POLICY_URL ?? '').trim();
export const TERMS_URL: string = (process.env.EXPO_PUBLIC_TERMS_URL ?? '').trim();

/**
 * Base URL of the activation server. Empty means offline-only licensing:
 * the app verifies signatures and expiry, but does not count devices or
 * support revocation.
 */
export const ACTIVATION_SERVER_URL: string = (process.env.EXPO_PUBLIC_ACTIVATION_URL ?? '').trim();

/**
 * How long the app keeps working on an expired lease when the activation
 * server cannot be reached. This is deliberately generous: a customer who has
 * paid should not lose access because your server had an outage or because
 * they are on a plane.
 */
export const ACTIVATION_GRACE_HOURS: number = (() => {
  const raw = Number(process.env.EXPO_PUBLIC_ACTIVATION_GRACE_HOURS ?? 336); // 14 days
  return Number.isFinite(raw) && raw > 0 ? raw : 336;
})();
