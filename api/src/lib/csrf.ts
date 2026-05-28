/**
 * CSRF helpers for the public consent flow.
 *
 * Synchronizer-token pattern, two halves:
 *   - GET issues a random nonce as both a `Set-Cookie` (HttpOnly +
 *     SameSite=Strict + Secure + Path=/consent) AND as a hidden form input.
 *   - POST compares the cookie against the form input with a
 *     constant-time check.
 *
 * SameSite=Strict alone defeats classic cross-site auto-submission; the
 * double-submit nonce defends against a same-site iframe / popup scenario
 * where the cookie still rides along but the attacker can't read it to
 * mirror it in the hidden field.
 *
 * Mounted only on the public, unauthenticated consent routes — the
 * authenticated API uses Clerk session JWT verification + an
 * APP_BASE_URL-locked CORS policy instead.
 */
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { constantTimeEqual, randomHexToken } from "./hash";

export const CSRF_FIELD = "csrf";

// Scope cookies per flow so opening both a consent page and a revoke
// page in the same browser doesn't have the later GET clobber the
// earlier nonce and 403 the older form on submit.
export type CsrfScope = "consent" | "revoke";

const cookieName = (scope: CsrfScope): string =>
	scope === "revoke" ? "pt_revoke_csrf" : "pt_consent_csrf";

const cookiePath = (scope: CsrfScope): string =>
	scope === "revoke" ? "/consent/revoke" : "/consent";

const CSRF_TTL_SECONDS = 30 * 60; // 30 minutes — long enough to read + submit

/**
 * Issues a fresh CSRF nonce, sets it as a same-site cookie scoped to
 * `scope`, and returns the nonce so the caller can render it into the
 * form as a hidden field.
 */
export const issueCsrfToken = (c: Context, scope: CsrfScope): string => {
	const nonce = randomHexToken(32);
	setCookie(c, cookieName(scope), nonce, {
		path: cookiePath(scope),
		httpOnly: true,
		sameSite: "Strict",
		secure: true,
		maxAge: CSRF_TTL_SECONDS,
	});
	return nonce;
};

/**
 * Returns the hidden form field HTML to embed inside the consent form.
 * Pre-escaped (nonces are hex-only, so escaping is a no-op, but keeps
 * the API consistent).
 */
export const csrfFormField = (nonce: string): string =>
	`<input type="hidden" name="${CSRF_FIELD}" value="${nonce}" />`;

/**
 * Validates the CSRF nonce on a POST. Returns true if the cookie for
 * `scope` matches the form-submitted value. Callers should respond 403
 * on failure.
 */
export const validateCsrfToken = (
	c: Context,
	scope: CsrfScope,
	formValue: unknown,
): boolean => {
	const cookieValue = getCookie(c, cookieName(scope));
	if (typeof cookieValue !== "string" || cookieValue.length === 0) return false;
	if (typeof formValue !== "string" || formValue.length === 0) return false;
	return constantTimeEqual(cookieValue, formValue);
};
