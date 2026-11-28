/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/credentials.test.vitest.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:12-08:00 (1795866252)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, expect, test } from "vitest";
import { inspect } from "node:util";
import { createUnifi } from "@cldmv/lib-unifi";
import { legacyRoutes, mockFetch, CONTROLLER } from "./helpers/routes.mjs";

const SECRET = "doc-password-s3cret";
const LEGACY_CREDS = { legacy: { username: "digby-operator", password: SECRET } };

/** True when a rendered value leaks either credential value. */
const leaks = (rendered) => rendered.includes(SECRET) || rendered.includes("digby-operator");

describe("credentials enter through the factory", () => {
	test("a getter form (sync and async) resolves once at compose time", async () => {
		const fetch = mockFetch(legacyRoutes());
		let getterCalls = 0;
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: () => {
				getterCalls += 1;
				return LEGACY_CREDS;
			}
		});
		expect((await unifi.capabilities()).networks).toBe("legacy");
		expect(getterCalls).toBe(1);

		const fetchAsync = mockFetch(legacyRoutes());
		const unifiAsync = await createUnifi({
			baseUrl: CONTROLLER,
			fetch: fetchAsync,
			credentials: async () => LEGACY_CREDS
		});
		expect((await unifiAsync.capabilities()).networks).toBe("legacy");
		await unifi.slothlet.shutdown();
		await unifiAsync.slothlet.shutdown();
	});

	test("a promise form resolves at compose time", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: Promise.resolve(LEGACY_CREDS) });
		expect((await unifi.capabilities()).networks).toBe("legacy");
		await unifi.slothlet.shutdown();
	});
});

describe("credentials never leak into errors", () => {
	test("an auth failure's error carries no credential value", async () => {
		const fetch = mockFetch(legacyRoutes({ login: "none" }));
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const caps = await unifi.capabilities();
		// The capability report and its auth failure are clean.
		expect(leaks(JSON.stringify(caps))).toBe(false);
		expect(leaks(inspect(caps.authError))).toBe(false);
		// So is the thrown error a leaf surfaces.
		let thrown = null;
		try {
			await unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10");
		} catch (err) {
			thrown = err;
		}
		expect(thrown).toBeTruthy();
		expect(leaks(JSON.stringify(thrown))).toBe(false);
		expect(leaks(inspect(thrown))).toBe(false);
		expect(leaks(String(thrown))).toBe(false);
		// The wire never saw the credentials outside the login request bodies.
		const nonLogin = fetch.calls.filter((call) => !call.pathname.startsWith("/api/auth/login") && !call.pathname.startsWith("/api/login"));
		for (const call of nonLogin) {
			expect(leaks(JSON.stringify(call.headers))).toBe(false);
			expect(leaks(String(call.body ?? ""))).toBe(false);
		}
		await unifi.slothlet.shutdown();
	});

	test("a login failure's thrown AuthError is clean", async () => {
		const fetch = mockFetch(legacyRoutes({ login: "none" }));
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const caps = await unifi.capabilities();
		expect(caps.authError.code).toBe("AUTH_LOGIN_FAILED");
		// The attempt messages name URLs, not credentials.
		for (const attempt of caps.authError.attempts) {
			expect(leaks(attempt)).toBe(false);
		}
		await unifi.slothlet.shutdown();
	});

	test("dry-run answers carry no credentials and no session headers", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const plan = await unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10", { dryRun: true });
		const rendered = JSON.stringify(plan);
		expect(leaks(rendered)).toBe(false);
		expect(rendered).not.toContain("Cookie");
		expect(rendered).not.toContain("X-Csrf-Token");
		await unifi.slothlet.shutdown();
	});
});
