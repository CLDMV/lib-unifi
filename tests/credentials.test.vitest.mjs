/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/credentials.test.vitest.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:08-08:00 (1795870568)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { describe, expect, test } from "vitest";
import { inspect } from "node:util";
import { createUnifi } from "@cldmv/lib-unifi";
import { legacyRoutes, officialRoutes, mockFetch, CONTROLLER } from "./helpers/routes.mjs";
import { fixture } from "./helpers/mock-fetch.mjs";

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

describe("credentials never leak through the api, the context or the reports", () => {
	const API_KEY = "doc-api-key-secret-123";
	const USERNAME = "digby-operator";
	const PASSWORD = SECRET;
	/** Every credential value the library holds, in every spelling. */
	const SECRETS = [API_KEY, USERNAME, PASSWORD];
	/** True when a rendered value carries any of them. */
	const leaksAny = (rendered) => SECRETS.some((secret) => rendered.includes(secret));

	/**
	 * Runs the full leak sweep against one composed instance: the api object,
	 * the slothlet management surface, the context value and every report the
	 * probe produced — through JSON.stringify AND util.inspect.
	 */
	async function expectNoLeak(unifi) {
		const context = await unifi.slothlet.context.get();
		const caps = await unifi.capabilities();
		// The `fetch` key is the CALLER'S own function — in these tests a mock
		// carrying its call log (which of course holds the login body it was
		// sent). Its records are caller state, not library leakage, so the
		// context sweep renders the settings without it.
		const { fetch: _callersFetch, ...settings } = context.unifi;
		void _callersFetch;
		for (const [label, rendered] of [
			["api", JSON.stringify(unifi)],
			["api inspect", inspect(unifi, { depth: 8 })],
			["context", JSON.stringify({ unifi: settings })],
			["context inspect", inspect({ unifi: settings }, { depth: 8 })],
			["capabilities", JSON.stringify(caps)],
			["capabilities inspect", inspect(caps, { depth: 8 })]
		]) {
			expect(leaksAny(rendered), `${label} leaks a credential`).toBe(false);
		}
		// The context hands back the settings object (under the `unifi` key the
		// factory set): non-secret config only — no credentials key, and no
		// callable accessor that would return a credential value either.
		expect(Object.keys(context)).toEqual(["unifi"]);
		expect(Object.keys(context.unifi)).toEqual(expect.arrayContaining(["baseUrl", "site", "timeoutMs", "userAgent"]));
		expect(context.unifi).not.toHaveProperty("credentials");
		for (const value of Object.values(context.unifi)) {
			if (typeof value === "object" && value !== null) {
				expect(Object.keys(value)).not.toContain("apiKey");
				expect(Object.keys(value)).not.toContain("password");
				expect(Object.keys(value)).not.toContain("username");
			}
		}
	}

	test("both credentials, plain form: nothing readable back from api or context", async () => {
		const fetch = mockFetch([...officialRoutes(), ...legacyRoutes()]);
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: API_KEY, legacy: { username: USERNAME, password: PASSWORD } }
		});
		await expectNoLeak(unifi);
		// The wire saw the secrets only in the login body and the X-API-KEY header.
		for (const call of fetch.calls) {
			const isLogin = call.pathname === "/api/auth/login" || call.pathname === "/api/login";
			if (!isLogin) {
				expect(leaksAny(String(call.body ?? "")), call.url).toBe(false);
				// The official path's X-API-KEY header is where the key is SUPPOSED
				// to ride — every other header must be clean.
				const headers = Object.entries(call.headers).filter(([key]) => key.toLowerCase() !== "x-api-key");
				expect(
					headers.some(([, v]) => leaksAny(String(v))),
					call.url
				).toBe(false);
			}
		}
		await unifi.slothlet.shutdown();
	});

	test("both credentials, getter and promise forms: same isolation", async () => {
		let getterCalls = 0;
		const fetchGetter = mockFetch([...officialRoutes(), ...legacyRoutes()]);
		const fromGetter = await createUnifi({
			baseUrl: CONTROLLER,
			fetch: fetchGetter,
			credentials: () => {
				getterCalls += 1;
				return { apiKey: API_KEY, legacy: { username: USERNAME, password: PASSWORD } };
			}
		});
		await expectNoLeak(fromGetter);
		expect(getterCalls).toBe(1);
		await fromGetter.slothlet.shutdown();

		const fetchPromise = mockFetch([...officialRoutes(), ...legacyRoutes()]);
		const fromPromise = await createUnifi({
			baseUrl: CONTROLLER,
			fetch: fetchPromise,
			credentials: Promise.resolve({ apiKey: API_KEY, legacy: { username: USERNAME, password: PASSWORD } })
		});
		await expectNoLeak(fromPromise);
		await fromPromise.slothlet.shutdown();
	});

	test("an official 401 error and a refused login carry no credential value", async () => {
		const fetch = mockFetch([
			{ path: "/proxy/network/integration/v1/info", status: 401, body: fixture("official/error-unauthorized") },
			...legacyRoutes({ login: "none" })
		]);
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: API_KEY, legacy: { username: USERNAME, password: PASSWORD } }
		});
		const caps = await unifi.capabilities();
		expect(caps.officialError).toMatchObject({ code: "OFFICIAL_UNAUTHORIZED" });
		expect(caps.authError).toMatchObject({ code: "AUTH_LOGIN_FAILED" });
		expect(leaksAny(JSON.stringify(caps))).toBe(false);
		// A leaf surfacing the official failure hands the same clean error back.
		let thrown = null;
		try {
			await unifi.networks.list();
		} catch (err) {
			thrown = err;
		}
		expect(thrown).toBeTruthy();
		expect(leaksAny(JSON.stringify(thrown))).toBe(false);
		expect(leaksAny(inspect(thrown, { depth: 8 }))).toBe(false);
		expect(leaksAny(String(thrown))).toBe(false);
		await unifi.slothlet.shutdown();
	});

	test("a transport throw carries no credential value", async () => {
		const fetch = () => {
			throw new Error("socket hung up");
		};
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: API_KEY, legacy: { username: USERNAME, password: PASSWORD } }
		});
		// The probe classifies; both failures ride the report clean.
		const caps = await unifi.capabilities();
		expect(caps.officialError).toMatchObject({ code: "OFFICIAL_UNREACHABLE" });
		expect(caps.authError).toMatchObject({ code: "AUTH_LOGIN_FAILED" });
		expect(leaksAny(JSON.stringify(caps))).toBe(false);
		// A leaf surfacing either failure hands the same clean error back.
		let thrown = null;
		try {
			await unifi.networks.list();
		} catch (err) {
			thrown = err;
		}
		expect(thrown).toBeTruthy();
		expect(leaksAny(JSON.stringify(thrown))).toBe(false);
		expect(leaksAny(inspect(thrown, { depth: 8 }))).toBe(false);
		expect(leaksAny(String(thrown))).toBe(false);
		await unifi.slothlet.shutdown();
	});

	test("dry-run answers on both paths carry no credential value", async () => {
		const fetch = mockFetch([...officialRoutes(), ...legacyRoutes()]);
		const unifi = await createUnifi({
			baseUrl: CONTROLLER,
			fetch,
			credentials: { apiKey: API_KEY, legacy: { username: USERNAME, password: PASSWORD } }
		});
		const officialPlan = await unifi.dns.forward.set({ domain: "printer.example.com", target: "192.0.2.53" }, { dryRun: true });
		const legacyPlan = await unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10", { dryRun: true });
		for (const plan of [officialPlan, legacyPlan]) {
			expect(leaksAny(JSON.stringify(plan))).toBe(false);
			expect(JSON.stringify(plan)).not.toContain("Cookie");
			expect(JSON.stringify(plan)).not.toContain("X-API-KEY");
		}
		await unifi.slothlet.shutdown();
	});
});
