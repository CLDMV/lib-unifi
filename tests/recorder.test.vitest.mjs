/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/recorder.test.vitest.mjs
 *	@Date: 2026-11-28T04:52:28-08:00 (1795870348)
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
import { createScrubber, scrub } from "./helpers/scrub.mjs";

/**
 * @fileoverview The fixture recorder's scrubber (tests/recorder.mjs) on
 * synthetic input. The recorder itself is the maintainer's tool and is never
 * run by the suite — only its scrubber is tested here.
 */

const SYNTHETIC = {
	name: "Office AP 1st floor",
	hostname: "udm-pro.homelab.example.internal",
	desc: "Front desk printer",
	email: "ops@example-corp.net",
	mac: "aa:bb:cc:dd:ee:ff",
	ipAddress: "10.0.14.22",
	fixed_ip: "10.0.14.200",
	last_ip: "10.0.14.201",
	domain: "files.example-corp.net",
	key: "files.example-corp.net",
	id: "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
	_id: "a1b2c3d4e5f6a7b8c9d0e1f2",
	token: "TOKEN=live-session-token-value",
	x_password: "live-radius-password",
	csrfToken: "live-csrf-value",
	nested: {
		name: "IoT VLAN 20",
		uplink: { uplink_mac: "AA:BB:CC:DD:EE:01", uplink_device_name: "Core Switch" },
		rows: [{ mac: "aa:bb:cc:dd:ee:02", ip: "10.0.14.23" }]
	},
	kept: { enabled: true, count: 3, version: "7.4.187", ratio: 1.5, nothing: null }
};

describe("the recorder's scrubber", () => {
	test("names, MACs, IPs, ids, tokens and secrets are all replaced", () => {
		const out = scrub(SYNTHETIC);
		const rendered = JSON.stringify(out);
		// No source value survives.
		for (const secret of [
			"Office AP 1st floor",
			"udm-pro.homelab.example.internal",
			"Front desk printer",
			"ops@example-corp.net",
			"aa:bb:cc:dd:ee:ff",
			"10.0.14.",
			"d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c",
			"a1b2c3d4e5f6a7b8c9d0e1f2",
			"live-session-token-value",
			"live-radius-password",
			"live-csrf-value",
			"IoT VLAN 20",
			"Core Switch",
			"example-corp.net"
		]) {
			expect(rendered.includes(secret), secret).toBe(false);
		}
	});

	test("MACs map into the documentation range consistently", () => {
		const scrubber = createScrubber();
		const out = scrub({ a: "aa:bb:cc:dd:ee:ff", b: "aa:bb:cc:dd:ee:ff", c: "AA-BB-CC-DD-EE-01" }, scrubber);
		expect(out.a).toBe(out.b);
		expect(out.a).toMatch(/^00:00:5e:00:53:[0-9a-f]{2}$/);
		expect(out.c).toMatch(/^00:00:5e:00:53:[0-9a-f]{2}$/);
		expect(out.a).not.toBe(out.c);
	});

	test("IPs land in the RFC 5737 documentation blocks", () => {
		const out = scrub({ a: "10.0.14.22", b: "10.0.14.200", gateway: "10.0.14.1" });
		for (const ip of [out.a, out.b, out.gateway]) {
			expect(ip).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/);
		}
	});

	test("ids become patterned stand-ins, not real-shaped ids", () => {
		const out = scrub({ uuid: "d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c", hex24: "a1b2c3d4e5f6a7b8c9d0e1f2" });
		expect(out.uuid).toMatch(/^u1a2b3c4.-d5e6-4f7a-8b9c-[0-9a-f]{12}$/);
		expect(out.uuid).not.toBe("d1a2b3c4-d5e6-4f7a-8b9c-0d1e2f3a4b5c");
		expect(out.hex24).toMatch(/^[0-9a-f]{24}$/);
		expect(out.hex24).not.toBe("a1b2c3d4e5f6a7b8c9d0e1f2");
	});

	test("domain-bearing fields are scrubbed; numbers and booleans are untouched", () => {
		const out = scrub(SYNTHETIC);
		expect(out.domain).not.toContain("example-corp.net");
		expect(out.key).not.toContain("example-corp.net");
		expect(out.kept).toEqual({ enabled: true, count: 3, version: "7.4.187", ratio: 1.5, nothing: null });
	});

	test("a shared scrubber maps the same source value to the same stand-in across calls", () => {
		const scrubber = createScrubber();
		const first = scrub({ mac: "aa:bb:cc:dd:ee:ff", ip: "10.0.14.22" }, scrubber);
		const second = scrub({ mac: "aa:bb:cc:dd:ee:ff", ip: "10.0.14.22" }, scrubber);
		expect(second).toEqual(first);
	});
});
