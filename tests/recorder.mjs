/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: tests/recorder.mjs
 *	@Date: 2026-11-28T04:47:33-08:00 (1795870053)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:08-08:00 (1795870568)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The fixture recorder (PLAN §6.2, "Fixtures") — MAINTAINER ONLY.
 *
 * It reads the controller endpoints the committed fixtures document, scrubs
 * every name, MAC, IP, id and token out of each answer (tests/helpers/scrub.mjs)
 * and writes the scrubbed JSON to `tmp/fixtures-recorded/` — a gitignored
 * scratch directory. Nothing recorded is ever committed: the committed
 * fixtures stay hand-written; the recorded output exists so the maintainer can
 * eyeball real response shapes (field presence, envelope variants) against the
 * hand-written ones.
 *
 * The recorder only ever sends reads and the login. It never writes to the
 * controller.
 *
 * Usage (maintainer, on a host that can reach the controller):
 *
 *   node tests/recorder.mjs \
 *     --base-url https://192.0.2.1 \
 *     --username <local account> --password <local account password> \
 *     [--api-key <Integration API key>] [--site default]
 *
 * Every argument can also arrive as an environment variable (BASE_URL,
 * USERNAME, PASSWORD, API_KEY, SITE). The credentials are used in memory only.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createScrubber, scrub } from "./helpers/scrub.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Parses --flag value / --flag=value arguments over environment defaults. */
function arg(name, envName) {
	const argv = process.argv.slice(2);
	const flag = `--${name}`;
	const index = argv.indexOf(flag);
	if (index !== -1) return argv[index + 1];
	const withEquals = argv.find((a) => a.startsWith(`${flag}=`));
	if (withEquals) return withEquals.slice(flag.length + 1);
	return process.env[envName];
}

const BASE_URL = arg("base-url", "BASE_URL");
const USERNAME = arg("username", "USERNAME");
const PASSWORD = arg("password", "PASSWORD");
const API_KEY = arg("api-key", "API_KEY");
const SITE = arg("site", "SITE") || "default";
const OUT_DIR = arg("out-dir", "OUT_DIR") || join(root, "tmp", "fixtures-recorded");

const scrubber = createScrubber();

/**
 * One authenticated read: fetch the URL with the session headers (or the API
 * key), parse JSON, scrub, and return the answer.
 * @param {string} url
 * @param {{ apiKey?: string, cookies?: string, csrfToken?: string|null }} auth
 * @returns {Promise<any>} the scrubbed answer, or null when the read failed
 */
async function read(url, auth) {
	const headers = {
		"Accept": "application/json",
		...(auth.cookies ? { "Cookie": auth.cookies } : {}),
		...(auth.csrfToken ? { "X-Csrf-Token": auth.csrfToken } : {}),
		...(auth.apiKey ? { "X-API-KEY": auth.apiKey } : {})
	};
	try {
		const res = await fetch(url, { headers });
		if (!res.ok) {
			console.error(`read failed ${res.status} ${url}`);
			return null;
		}
		const text = await res.text();
		if (text.trim() === "") return null;
		return scrub(JSON.parse(text), scrubber);
	} catch (err) {
		console.error(`read failed ${url}: ${err?.message ?? err}`);
		return null;
	}
}

/** Writes one scrubbed answer with the recorder's provenance marker. */
function write(name, answer) {
	if (answer === null) return;
	mkdirSync(OUT_DIR, { recursive: true });
	writeFileSync(
		join(OUT_DIR, `${name}.json`),
		`${JSON.stringify({ _source: "recorded from a live controller by the maintainer and scrubbed (tests/recorder.mjs); never committed", ...answer }, null, "\t")}\n`
	);
	console.log(`wrote ${name}.json`);
}

/** The recorder's main — only runs when invoked directly (never on import). */
async function main() {
	if (!BASE_URL || !USERNAME || !PASSWORD) {
		console.error("usage: node tests/recorder.mjs --base-url <url> --username <u> --password <p> [--api-key <k>] [--site <s>]");
		process.exit(1);
	}
	const base = BASE_URL.replace(/\/+$/, "");

	// --- UniFi OS login (the recorder's only non-read) ---
	const loginRes = await fetch(`${base}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json", "Accept": "application/json" },
		body: JSON.stringify({ username: USERNAME, password: PASSWORD })
	});
	if (!loginRes.ok) {
		console.error(`login failed: ${loginRes.status}`);
		process.exit(1);
	}
	const cookies = (
		typeof loginRes.headers.getSetCookie === "function"
			? loginRes.headers.getSetCookie()
			: [loginRes.headers.get("set-cookie")].filter(Boolean)
	)
		.map((cookie) => cookie.split(";")[0].trim())
		.join("; ");
	const csrfToken = loginRes.headers.get("x-csrf-token");
	const auth = { cookies, csrfToken, apiKey: API_KEY };

	const proxy = `${base}/proxy/network`;
	const official = `${proxy}/integration/v1`;

	// --- legacy reads ---
	write("legacy-sysinfo", await read(`${proxy}/api/s/${SITE}/stat/sysinfo`, auth));
	write("legacy-sites", await read(`${proxy}/api/stat/sites`, auth));
	write("legacy-devices", await read(`${proxy}/api/s/${SITE}/stat/device`, auth));
	write("legacy-clients", await read(`${proxy}/api/s/${SITE}/stat/sta`, auth));
	write("legacy-user-records", await read(`${proxy}/api/s/${SITE}/rest/user`, auth));
	write("legacy-networkconf", await read(`${proxy}/api/s/${SITE}/rest/networkconf`, auth));
	write("legacy-portconf", await read(`${proxy}/api/s/${SITE}/rest/portconf`, auth));
	write("legacy-static-dns", await read(`${proxy}/v2/api/site/${SITE}/static-dns`, auth));
	write("legacy-radius-users", await read(`${proxy}/v2/api/site/${SITE}/radius/users`, auth));
	write("legacy-admins", await read(`${proxy}/v2/api/site/${SITE}/user`, auth));

	// --- official reads ---
	write("official-info", await read(`${official}/info`, auth));
	write("official-sites", await read(`${official}/sites`, auth));
	const sites = (await read(`${official}/sites`, auth))?.data ?? [];
	const siteId = sites.find((site) => site?.internalReference === SITE || site?.name === SITE)?.id ?? sites[0]?.id;
	if (!siteId) {
		console.error("no official site id resolved — the official reads are skipped");
		return;
	}
	const scope = `${official}/sites/${siteId}`;
	write("official-networks", await read(`${scope}/networks`, auth));
	write("official-clients", await read(`${scope}/clients`, auth));
	write("official-devices", await read(`${scope}/devices`, auth));
	write("official-device-tags", await read(`${scope}/device-tags`, auth));
	write("official-pending-devices", await read(`${official}/pending-devices`, auth));
	write("official-dns-policies", await read(`${scope}/dns/policies`, auth));
	write("official-firewall-policies", await read(`${scope}/firewall/policies`, auth));
	write("official-firewall-zones", await read(`${scope}/firewall/zones`, auth));
	write("official-acl-rules", await read(`${scope}/acl-rules`, auth));
	write("official-traffic-matching-lists", await read(`${scope}/traffic-matching-lists`, auth));
	write("official-wifi-broadcasts", await read(`${scope}/wifi/broadcasts`, auth));
	write("official-radius-profiles", await read(`${scope}/radius/profiles`, auth));
	write("official-hotspot-vouchers", await read(`${scope}/hotspot/vouchers`, auth));
	write("official-switching-lags", await read(`${scope}/switching/lags`, auth));
	write("official-switch-stacks", await read(`${scope}/switching/switch-stacks`, auth));
	write("official-mc-lag-domains", await read(`${scope}/switching/mc-lag-domains`, auth));
	write("official-vpn-servers", await read(`${scope}/vpn/servers`, auth));
	write("official-vpn-tunnels", await read(`${scope}/vpn/site-to-site-tunnels`, auth));
	write("official-wans", await read(`${scope}/wans`, auth));
	write("official-dpi-applications", await read(`${official}/dpi/applications`, auth));
	write("official-dpi-categories", await read(`${official}/dpi/categories`, auth));
	write("official-countries", await read(`${official}/countries`, auth));
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
	await main();
}
