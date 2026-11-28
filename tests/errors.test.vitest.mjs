/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /tests/errors.test.vitest.mjs
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

import { describe, expect, test } from "vitest";
import { createUnifi } from "@cldmv/lib-unifi";
import { ApiError, AuthError, CapabilityError, ConfigError, TransportError, UnifiError, isUnifiError } from "../src/lib/errors.mjs";
import { officialList, officialPath, officialUrl, parseOfficialError } from "../src/lib/transport/official.mjs";
import { officialRoutes, legacyRoutes, mockFetch, CONTROLLER, OFFICIAL_ROOT, SITE_ID } from "./helpers/routes.mjs";

// The error-transport tests run through the composed api: lib modules read the
// instance context at call time, so a leaf call is the entry into them.
async function withInstance(config, run) {
	const unifi = await createUnifi(config);
	try {
		return await run(unifi);
	} finally {
		await unifi.slothlet.shutdown();
	}
}

const LEGACY_WITH_LOGIN = [
	{
		method: "POST",
		path: "/api/auth/login",
		...legacyRoutes().find((route) => route.method === "POST" && route.path === "/api/auth/login")
	},
	...legacyRoutes({ login: "none", sta: false })
];

describe("typed errors", () => {
	test("the class hierarchy and the type guard", () => {
		expect(new ConfigError("X", "m")).toBeInstanceOf(UnifiError);
		expect(new AuthError("X", "m")).toBeInstanceOf(UnifiError);
		expect(new ApiError(500, null, "m")).toBeInstanceOf(UnifiError);
		expect(new TransportError("X", "m")).toBeInstanceOf(UnifiError);
		expect(new CapabilityError("X", "m")).toBeInstanceOf(UnifiError);
		expect(isUnifiError(new TransportError("X", "m"))).toBe(true);
		expect(isUnifiError(new Error("plain"))).toBe(false);
		expect(isUnifiError(new TransportError("X", "m"), "X")).toBe(true);
		expect(isUnifiError(new TransportError("X", "m"), "Y")).toBe(false);
	});

	test("ApiError carries the status and the controller's own code", () => {
		const err = new ApiError(400, "api.dns.policy.validation.record-already-exists", "dup", { method: "POST", url: "https://x" });
		expect(err.status).toBe(400);
		expect(err.controllerCode).toBe("api.dns.policy.validation.record-already-exists");
		expect(err.method).toBe("POST");
	});
});

describe("official transport errors", () => {
	test("parseOfficialError understands the Integration API shape, the proxy shape, and non-JSON", () => {
		expect(
			parseOfficialError(
				JSON.stringify({
					statusCode: 401,
					statusName: "UNAUTHORIZED",
					code: "api.authentication.missing-credentials",
					message: "Missing Credentials"
				})
			)
		).toEqual({
			code: "api.authentication.missing-credentials",
			message: "Missing Credentials"
		});
		expect(parseOfficialError(JSON.stringify({ error: { code: 401, message: "Unauthorized" } }))).toEqual({
			code: "401",
			message: "Unauthorized"
		});
		expect(parseOfficialError("<html>502</html>")).toEqual({ code: null, message: "<html>502</html>" });
	});

	test("officialPath escapes ids and refuses slashes and empties", () => {
		// Spaces are escaped; a slash in an id would change the endpoint and is refused.
		expect(officialPath("sites", "a b")).toBe("/sites/a%20b");
		expect(officialPath("sites", SITE_ID, "dns", "policies")).toBe(`/sites/${SITE_ID}/dns/policies`);
		expect(() => officialPath("sites", "a/b")).toThrow();
		expect(() => officialPath("sites", "")).toThrow();
	});

	test("officialUrl joins the configured base", async () => {
		await withInstance({ baseUrl: CONTROLLER, fetch: mockFetch([]), credentials: { apiKey: "k" } }, async (unifi) => {
			await unifi.slothlet.context.run({}, async () => {
				expect(officialUrl("/info")).toBe(`${CONTROLLER}${OFFICIAL_ROOT}/info`);
				expect(officialUrl("/sites", { offset: 0, limit: 200 })).toBe(`${CONTROLLER}${OFFICIAL_ROOT}/sites?offset=0&limit=200`);
			});
		});
	});

	test("a 400 with the duplicate-policy code surfaces as ApiError with the controller code", async () => {
		const routes = [
			...officialRoutes(),
			{
				method: "POST",
				path: `${OFFICIAL_ROOT}/sites/${SITE_ID}/dns/policies`,
				status: 400,
				body: {
					statusCode: 400,
					statusName: "BAD_REQUEST",
					code: "api.dns.policy.validation.record-already-exists",
					message: "Record already exists"
				}
			}
		];
		await withInstance({ baseUrl: CONTROLLER, fetch: mockFetch(routes), credentials: { apiKey: "k" } }, async (unifi) => {
			await expect(unifi.dns.forward.set({ domain: "new.cldmv.net", target: "192.0.2.53" })).rejects.toMatchObject({
				code: "API_ERROR",
				status: 400,
				controllerCode: "api.dns.policy.validation.record-already-exists"
			});
		});
	});

	test("officialList refuses listings it cannot trust (drift, repeats, incomplete pages)", async () => {
		const driftFetch = mockFetch([
			{ path: `${OFFICIAL_ROOT}/x`, body: { offset: 0, limit: 200, count: 1, totalCount: 2, data: [{ id: "a" }] } },
			{ path: `${OFFICIAL_ROOT}/x`, body: { offset: 1, limit: 200, count: 2, totalCount: 3, data: [{ id: "b" }, { id: "c" }] } }
		]);
		await withInstance({ baseUrl: CONTROLLER, fetch: driftFetch, credentials: { apiKey: "k" } }, async (unifi) => {
			await unifi.slothlet.context.run({}, async () => {
				await expect(officialList("/x")).rejects.toMatchObject({ code: "TRANSPORT_PAGE_DRIFT" });
			});
		});

		const repeatFetch = mockFetch([
			{ path: `${OFFICIAL_ROOT}/x`, body: { offset: 0, limit: 200, count: 2, totalCount: 2, data: [{ id: "a" }, { id: "a" }] } }
		]);
		await withInstance({ baseUrl: CONTROLLER, fetch: repeatFetch, credentials: { apiKey: "k" } }, async (unifi) => {
			await unifi.slothlet.context.run({}, async () => {
				await expect(officialList("/x")).rejects.toMatchObject({ code: "TRANSPORT_PAGE_REPEAT" });
			});
		});

		const incompleteFetch = mockFetch([{ path: `${OFFICIAL_ROOT}/x`, body: { offset: 0, limit: 200, data: [{ id: "a" }] } }]);
		await withInstance({ baseUrl: CONTROLLER, fetch: incompleteFetch, credentials: { apiKey: "k" } }, async (unifi) => {
			await unifi.slothlet.context.run({}, async () => {
				await expect(officialList("/x")).rejects.toMatchObject({ code: "TRANSPORT_PAGE_INCOMPLETE" });
			});
		});

		const emptyPageFetch = mockFetch([{ path: `${OFFICIAL_ROOT}/x`, body: { offset: 0, limit: 200, count: 0, totalCount: 5, data: [] } }]);
		await withInstance({ baseUrl: CONTROLLER, fetch: emptyPageFetch, credentials: { apiKey: "k" } }, async (unifi) => {
			await unifi.slothlet.context.run({}, async () => {
				await expect(officialList("/x")).rejects.toMatchObject({ code: "TRANSPORT_PAGE_INCOMPLETE" });
			});
		});

		const okFetch = mockFetch([
			{ path: `${OFFICIAL_ROOT}/x`, body: { offset: 0, limit: 200, count: 1, totalCount: 1, data: [{ id: "a" }] } }
		]);
		await withInstance({ baseUrl: CONTROLLER, fetch: okFetch, credentials: { apiKey: "k" } }, async (unifi) => {
			await unifi.slothlet.context.run({}, async () => {
				expect(await officialList("/x")).toEqual([{ id: "a" }]);
			});
		});
	});

	test("the no-api-key path refuses with OFFICIAL_NO_API_KEY before anything is sent", async () => {
		const fetch = mockFetch([]);
		await withInstance({ baseUrl: CONTROLLER, fetch }, async (unifi) => {
			await unifi.slothlet.context.run({}, async () => {
				await expect(officialList("/x")).rejects.toMatchObject({ code: "OFFICIAL_NO_API_KEY" });
				expect(fetch.calls).toHaveLength(0);
			});
		});
	});
});

describe("legacy transport errors", () => {
	test("a non-2xx legacy answer is an ApiError carrying meta.msg", async () => {
		const fetch = mockFetch([
			...LEGACY_WITH_LOGIN,
			{ path: /\/stat\/sta$/, status: 403, body: { meta: { rc: "error", msg: "api.err.NoPermission" } } }
		]);
		await withInstance(
			{ baseUrl: CONTROLLER, fetch, credentials: { legacy: { username: "digby", password: "doc-password" } } },
			async (unifi) => {
				await expect(unifi.clients.list()).rejects.toMatchObject({
					code: "API_ERROR",
					status: 403,
					controllerCode: "api.err.NoPermission"
				});
			}
		);
	});

	test("an unparseable body is a TransportError", async () => {
		const fetch = mockFetch([...LEGACY_WITH_LOGIN, { path: /\/stat\/sta$/, body: "<html>not json</html>" }]);
		await withInstance(
			{ baseUrl: CONTROLLER, fetch, credentials: { legacy: { username: "digby", password: "doc-password" } } },
			async (unifi) => {
				await expect(unifi.clients.list()).rejects.toMatchObject({ code: "TRANSPORT_BODY_UNPARSEABLE" });
			}
		);
	});

	test("a fetch-level failure degrades to capability none instead of crashing the caller", async () => {
		const failing = async () => {
			throw new Error("connection refused");
		};
		await withInstance(
			{ baseUrl: CONTROLLER, fetch: failing, credentials: { legacy: { username: "digby", password: "doc-password" } } },
			async (unifi) => {
				const caps = await unifi.capabilities();
				expect(caps.networks).toBe("none");
				await expect(unifi.clients.list()).rejects.toMatchObject({ code: "CAPABILITY_UNAVAILABLE" });
			}
		);
	});
});
