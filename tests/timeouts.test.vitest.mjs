/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/timeouts.test.vitest.mjs
 *	@Date: 2026-11-28T04:52:20-08:00 (1795870340)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:09-08:00 (1795870569)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, expect, test } from "vitest";
import { createUnifi } from "@cldmv/lib-unifi";
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER } from "./helpers/routes.mjs";

const API_KEY = { apiKey: "doc-api-key" };
const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };

/** A fetch that hangs forever — the hung-controller case the timeouts exist for.
 * Like the real fetch, it honours the AbortSignal the library passes: the call
 * rejects when the signal fires, never otherwise. */
function hangingFetch() {
	const calls = [];
	const mock = async (url, init = {}) => {
		calls.push({ url: String(url), init });
		return new Promise((_, reject) => {
			init.signal?.addEventListener("abort", () => reject(new DOMException("This operation was aborted", "TimeoutError")), { once: true });
		});
	};
	mock.calls = calls;
	return mock;
}

describe("timeoutMs and loginTimeoutMs", () => {
	test("a hung controller fails the call instead of hanging it", async () => {
		const fetch = hangingFetch();
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY, timeoutMs: 50 });
		const startedAt = Date.now();
		// The probe classifies rather than raising; with a never-resolving fetch
		// and no timeout this call would hang forever — completing at all proves
		// the AbortSignal fired, and the official failure rides the report.
		const caps = await unifi.capabilities();
		expect(Date.now() - startedAt).toBeLessThan(5000);
		expect(caps.official).toBe(false);
		expect(caps.officialError.message).toContain("failed");
		expect(fetch.calls[0].init.signal).toBeInstanceOf(AbortSignal);
		await unifi.slothlet.shutdown();
	});

	test("a hung login times out with loginTimeoutMs, not timeoutMs", async () => {
		const fetch = hangingFetch();
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: LEGACY_CREDS,
			timeoutMs: 30000,
			loginTimeoutMs: 50
		});
		const startedAt = Date.now();
		const caps = await unifi.capabilities();
		// The probe classifies; the login failures ride the report.
		expect(caps.authError).toMatchObject({ code: "AUTH_LOGIN_FAILED" });
		expect(Date.now() - startedAt).toBeLessThan(5000);
		// The login attempt carried the login timeout, not the read timeout.
		expect(fetch.calls[0].init.signal).toBeInstanceOf(AbortSignal);
		await unifi.slothlet.shutdown();
	});

	test("a working controller is untouched by the default timeouts", async () => {
		const fetch = mockFetch([...officialRoutes(), ...legacyRoutes()]);
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: "doc-api-key", legacy: { username: "digby", password: "doc-password" } }
		});
		expect((await unifi.networks.list()).length).toBeGreaterThan(0);
		expect((await unifi.clients.list()).length).toBeGreaterThan(0);
		await unifi.slothlet.shutdown();
	});
});
