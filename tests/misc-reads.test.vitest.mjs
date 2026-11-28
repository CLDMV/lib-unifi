/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/misc-reads.test.vitest.mjs
 *	@Date: 2026-11-28T04:52:14-08:00 (1795870334)
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
import { createUnifi } from "@cldmv/lib-unifi";
import {
	officialRoutes,
	mockFetch,
	CONTROLLER,
	SITE_ID,
	LAG_ID,
	STACK_ID,
	MCLAG_ID,
	VOUCHER_ID,
	VPN_SERVER_ID,
	TUNNEL_ID
} from "./helpers/routes.mjs";

const API_KEY = { apiKey: "doc-api-key" };
const sitePath = `/proxy/network/integration/v1/sites/${SITE_ID}`;

describe("the official read-only collections", () => {
	test("switching: lags, stacks and mc-lag domains (list + get)", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		expect(await unifi.switching.lags.list()).toHaveLength(1);
		expect((await unifi.switching.lags.get(LAG_ID)).members[0].portIdxs).toEqual([23, 24]);
		expect((await unifi.switching.stacks.list())[0]).toMatchObject({ id: STACK_ID, name: "Closet stack" });
		expect((await unifi.switching.stacks.get(STACK_ID)).units[0].role).toBe("MASTER");
		expect((await unifi.switching.mclag.list())[0]).toMatchObject({ id: MCLAG_ID, name: "Core pair" });
		expect((await unifi.switching.mclag.get(MCLAG_ID)).peers[0].role).toBe("PRIMARY");
		await unifi.slothlet.shutdown();
	});

	test("vpn: servers and site-to-site tunnels", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		expect((await unifi.vpn.servers.list())[0]).toMatchObject({ id: VPN_SERVER_ID, type: "TELEPORT", enabled: true });
		expect((await unifi.vpn.tunnels.list())[0]).toMatchObject({ id: TUNNEL_ID, type: "IPSEC" });
		await unifi.slothlet.shutdown();
	});

	test("wan, dpi and countries", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		expect((await unifi.wan.list())[0]).toMatchObject({ id: "wan-1", name: "Internet 1" });
		const apps = await unifi.dpi.applications.list();
		expect(apps).toHaveLength(2);
		expect(apps[0]).toMatchObject({ id: 786435, name: "Adobe Express" });
		expect((await unifi.dpi.categories.list())[0]).toMatchObject({ id: 3, name: "Network protocols" });
		expect((await unifi.countries.list())[0]).toMatchObject({ code: "CK", name: "Cook Islands" });
		// The application-level collections are not site-scoped.
		expect(fetch.calls.find((call) => call.pathname === "/proxy/network/integration/v1/dpi/applications")).toBeTruthy();
		expect(fetch.calls.find((call) => call.pathname === "/proxy/network/integration/v1/countries")).toBeTruthy();
		await unifi.slothlet.shutdown();
	});
});

describe("hotspot vouchers", () => {
	test("list and get", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const vouchers = await unifi.hotspot.vouchers.list();
		expect(vouchers).toHaveLength(1);
		expect(vouchers[0]).toMatchObject({ id: VOUCHER_ID, code: 4861409510 });
		expect((await unifi.hotspot.vouchers.get(VOUCHER_ID)).name).toBe("guest");
		await unifi.slothlet.shutdown();
	});

	test("create answers the created voucher rows", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		const result = await unifi.hotspot.vouchers.create({ name: "guest", count: 2, timeLimitMinutes: 1440 });
		const post = fetch.calls.find((call) => call.method === "POST" && call.pathname === `${sitePath}/hotspot/vouchers`);
		expect(JSON.parse(post.body)).toMatchObject({ name: "guest", count: 2 });
		expect(result.response.vouchers).toHaveLength(1);
		await unifi.slothlet.shutdown();
	});

	test("delete one voucher, or every voucher when no id is given", async () => {
		const fetch = mockFetch(officialRoutes());
		const unifi = await createUnifi({ baseUrl: CONTROLLER, fetch, credentials: API_KEY });
		await unifi.capabilities();
		const callsBefore = fetch.calls.length;
		const one = await unifi.hotspot.vouchers.delete(VOUCHER_ID);
		const all = await unifi.hotspot.vouchers.delete();
		const newCalls = fetch.calls.slice(callsBefore);
		expect(newCalls.map((call) => call.pathname)).toEqual([`${sitePath}/hotspot/vouchers/${VOUCHER_ID}`, `${sitePath}/hotspot/vouchers`]);
		expect(one.response).toMatchObject({ vouchersDeleted: 1 });
		expect(all.response).toMatchObject({ vouchersDeleted: 2 });
		await unifi.slothlet.shutdown();
	});
});
