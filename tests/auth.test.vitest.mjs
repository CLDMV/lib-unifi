/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/auth.test.vitest.mjs
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
import { createUnifi } from "@cldmv/lib-unifi";
import { legacyRoutes, mockFetch, CONTROLLER } from "./helpers/routes.mjs";

const LEGACY_CREDS = { legacy: { username: "digby", password: "doc-password" } };

describe("legacy login", () => {
	test("UniFi OS login captures the session cookie and the CSRF token", async () => {
		const fetch = mockFetch(legacyRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const clients = await unifi.clients.list();
		expect(clients.length).toBeGreaterThan(0);
		const login = fetch.calls.find((call) => call.pathname === "/api/auth/login");
		expect(login).toBeTruthy();
		expect(login.method).toBe("POST");
		expect(JSON.parse(login.body)).toEqual({ username: "digby", password: "doc-password" });
		const read = fetch.calls.find((call) => call.pathname === "/proxy/network/api/s/default/stat/sta");
		expect(read.headers.Cookie).toBe("TOKEN=doc-token-cookie");
		expect(read.headers["X-Csrf-Token"]).toBe("doc-csrf-token-0001");
		await unifi.slothlet.shutdown();
	});

	test("falls back to the legacy :8443 login when the UniFi OS attempt fails", async () => {
		const routes = [
			{ method: "POST", path: "/api/auth/login", status: 401, body: { meta: { rc: "error", msg: "api.err.Invalid" } } },
			{ method: "POST", path: "/api/login", status: 200, setCookie: ["unifises=doc-legacy-cookie; Path=/"], body: "" },
			...legacyRoutes({ login: "none" })
		];
		const fetch = mockFetch(routes);
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const caps = await unifi.capabilities();
		expect(caps.networks).toBe("legacy");
		const fallback = fetch.calls.find((call) => call.pathname === "/api/login");
		expect(fallback).toBeTruthy();
		expect(fallback.headers.Referer).toBe(`${CONTROLLER}:8443/login`);
		// The legacy session rides subsequent calls.
		const read = fetch.calls.find((call) => call.pathname === "/api/s/default/rest/networkconf");
		expect(read.headers.Cookie).toBe("unifises=doc-legacy-cookie");
		await unifi.slothlet.shutdown();
	});

	test("a login without the unifises cookie is not a legacy session", async () => {
		const routes = [
			{ method: "POST", path: "/api/auth/login", status: 401, body: { meta: { rc: "error", msg: "api.err.Invalid" } } },
			{ method: "POST", path: "/api/login", status: 200, setCookie: ["other=cookie; Path=/"], body: "" },
			...legacyRoutes({ login: "none" })
		];
		const fetch = mockFetch(routes);
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		// The probe classifies; the auth failure rides the report.
		const caps = await unifi.capabilities();
		expect(caps.authError).toMatchObject({ code: "AUTH_LOGIN_FAILED" });
		expect(fetch.calls.filter((call) => call.pathname === "/api/login")).toHaveLength(1);
		await expect(unifi.clients.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		await unifi.slothlet.shutdown();
	});

	test("both attempts failing reports both attempts on the capability report", async () => {
		const fetch = mockFetch(legacyRoutes({ login: "none" }));
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const caps = await unifi.capabilities();
		expect(caps.authError).toMatchObject({ code: "AUTH_LOGIN_FAILED" });
		expect(caps.authError.attempts).toHaveLength(2);
		await expect(unifi.clients.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
		await unifi.slothlet.shutdown();
	});

	test("an incomplete legacy account (no password) probes to none and refuses the legacy-only write", async () => {
		const fetch = mockFetch([]);
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: { legacy: { username: "digby" } } });
		const caps = await unifi.capabilities();
		expect(caps.networks).toBe("none");
		// The fixed-IP write is legacy-only; the official surface is not configured either.
		await expect(unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10")).rejects.toMatchObject({
			code: "CAPABILITY_UNAVAILABLE",
			capability: "fixedIp"
		});
		expect(fetch.calls).toHaveLength(0);
		await unifi.slothlet.shutdown();
	});

	test("a 401 mid-session clears the session and re-logs in once", async () => {
		let staCalls = 0;
		// The capability probe's client_list read is the first sta call (succeeds);
		// clients.list's read is the second (401 -> re-login -> retry succeeds).
		const fetch = mockFetch([
			{
				method: "POST",
				path: "/api/auth/login",
				...legacyRoutes().find((route) => route.method === "POST" && route.path === "/api/auth/login")
			},
			...legacyRoutes({ login: "none", sta: false }),
			{
				path: /\/stat\/sta$/,
				match: () => {
					staCalls += 1;
					return staCalls === 2;
				},
				status: 401,
				body: { meta: { rc: "error", msg: "api.err.LoginRequired" } }
			},
			{ path: /\/stat\/sta$/, body: { meta: { rc: "ok" }, data: [] } }
		]);
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: LEGACY_CREDS });
		const clients = await unifi.clients.list();
		expect(clients).toEqual([]);
		// Two logins: the probe's, plus the re-login after the 401.
		expect(fetch.calls.filter((call) => call.pathname === "/api/auth/login")).toHaveLength(2);
		expect(staCalls).toBe(3);
		await unifi.slothlet.shutdown();
	});
});
