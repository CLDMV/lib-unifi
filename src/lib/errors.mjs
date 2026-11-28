/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/lib/errors.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1764329220)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:07:00-07:00 (1764329220)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Typed errors for the UniFi library. Every failure the library
 * raises is one of these classes, so callers can branch on `error.code`
 * instead of string matching. `process.exit` paths from unifi-cli's
 * `lib/api/request/request.mjs` and `lib/api/login/login.mjs` become typed
 * errors here — the library never exits the process.
 */

/** Base class for every error the library raises. */
export class UnifiError extends Error {
	/** @param {string} code machine-readable code, e.g. "AUTH_LOGIN_FAILED" */
	constructor(code, message, options = {}) {
		super(message, options);
		this.name = new.target.name;
		this.code = code;
	}
}

/** Factory configuration problems: a missing baseUrl, a non-function fetch. */
export class ConfigError extends UnifiError {}

/** Legacy login failures: both the UniFi OS and the legacy attempt refused. */
export class AuthError extends UnifiError {
	constructor(code, message, options = {}) {
		super(code, message, options);
		this.attempts = options.attempts ?? null;
	}
}

/** A controller answered with a non-2xx status or an unusable body. */
export class ApiError extends UnifiError {
	/**
	 * @param {number|null} status HTTP status, null when the request never got one
	 * @param {string|null} controllerCode the controller's own error code
	 *   (Integration API `code`, legacy `meta.msg`, or null)
	 */
	constructor(status, controllerCode, message, options = {}) {
		super("API_ERROR", message, options);
		this.status = status ?? null;
		this.controllerCode = controllerCode ?? null;
		this.method = options.method ?? null;
		this.url = options.url ?? null;
	}
}

/** The transport itself failed: the injected fetch threw or the body was unusable. */
export class TransportError extends UnifiError {}

/** The probed capability for an operation is unavailable (or no credentials cover it). */
export class CapabilityError extends UnifiError {
	constructor(code, message, options = {}) {
		super(code, message, options);
		this.capability = options.capability ?? null;
		this.hint = options.hint ?? null;
	}
}

/** A caller passed something the library cannot build a request from. */
export class ValidationError extends UnifiError {}

/** The class names the type guard recognizes across instance boundaries. */
const UNIFI_ERROR_NAMES = new Set([
	"UnifiError",
	"ConfigError",
	"AuthError",
	"ApiError",
	"TransportError",
	"CapabilityError",
	"ValidationError"
]);

/**
 * Type guard. Optionally matches on the machine-readable code. instanceof
 * alone is not enough — a caller (and a test) may hold an error across a
 * slothlet instance boundary, where the class identity is a different module
 * copy — so the name+code shape is the stable contract.
 * @param {unknown} err
 * @param {string} [code]
 * @returns {boolean}
 */
export function isUnifiError(err, code) {
	// instanceof alone is not enough: a caller (and a test) may hold the error
	// across a slothlet instance boundary, where the class identity is a
	// different module copy. The name+code shape is the stable contract.
	const shaped = err instanceof Error && UNIFI_ERROR_NAMES.has(err.name) && typeof err.code === "string";
	if (!shaped) return false;
	return code === undefined || err.code === code;
}
