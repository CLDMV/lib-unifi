/**
 *	@Project: @cldmv/lib-unifi
 *	@Filename: /src/api/clients/fixed/ip/set.mjs
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

import { self } from "@cldmv/slothlet/runtime";
import { ApiError, CapabilityError, ValidationError } from "../../../../lib/errors.mjs";
import { legacyRequest, legacyUrl, envelopeData } from "../../../../lib/transport/request.mjs";
import { resolveClientId, isIpv4, normalizeMac } from "../../../../lib/normalize/client.mjs";

/**
 * @fileoverview `clients.fixed.ip.set(mac, ip, options)` — the normalised
 * `client.fixedIp.set` write: set a client's fixed IP.
 *
 * The write is a legacy-API capability: it PUTs `{ fixed_ip, use_fixedip:
 * true }` to `api/s/{site}/rest/user/{id}` (unifi-cli's `client_update` row),
 * after resolving the MAC to the controller's `_id` — the `rest/user` record
 * id first, then the `stat/sta` row id. The `{ meta: { rc } }` response is
 * normalized to `{ ok }`.
 *
 * Every write takes `{ dryRun: true }` and answers the change it would make;
 * dry-run answers never carry credentials.
 *
 * @param {string} mac the client's MAC address
 * @param {string} ip the IPv4 address to fix
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok, mac, ip, id }`, or the dry-run request
 *   description
 * @throws {CapabilityError} when the legacy path is unavailable
 * @throws {ValidationError} on a bad MAC or IP
 * @throws {ApiError} 404-shaped when no client with that MAC is known
 */
export default async function set(mac, ip, options = {}) {
	const normalizedMac = normalizeMac(mac);
	if (!normalizedMac) {
		throw new ValidationError("VALIDATION_MAC", `clients.fixed.ip.set needs a MAC address, got ${JSON.stringify(mac)}`);
	}
	if (typeof ip !== "string" || !isIpv4(ip)) {
		throw new ValidationError("VALIDATION_IP", `clients.fixed.ip.set needs an IPv4 address, got ${JSON.stringify(ip)}`);
	}

	const caps = await self.capabilities();
	if (caps.fixedIp !== "legacy") {
		throw new CapabilityError(
			"CAPABILITY_UNAVAILABLE",
			"the fixed-IP write is a legacy controller API capability and the legacy path is unavailable",
			{
				capability: "fixedIp",
				hint: "pass credentials.legacy to createUnifi; the official Integration API carries no client fixed-IP write"
			}
		);
	}

	// The client config records carry the canonical id for the write; the
	// connected-client rows are the fallback when a MAC has no record yet. A
	// controller without a rest/user collection (older builds) still resolves
	// through stat/sta.
	let records = [];
	try {
		const recordsBody = await legacyRequest({ endpoint: "client_records", method: "GET" });
		records = Array.isArray(recordsBody) ? recordsBody : envelopeData(recordsBody);
	} catch (err) {
		if (err?.status !== 404) throw err;
	}
	const staBody = await legacyRequest({ endpoint: "client_list", method: "GET" });
	const staRows = Array.isArray(staBody) ? staBody : envelopeData(staBody);
	const clientId = resolveClientId(records, staRows, normalizedMac);
	if (!clientId) {
		throw new ApiError(404, null, `no client with MAC ${normalizedMac} is known to the controller`);
	}

	const body = { fixed_ip: ip, use_fixedip: true };
	const url = legacyUrl("client_update", { id: clientId });
	if (options.dryRun) {
		return { dryRun: true, capability: "legacy", mac: normalizedMac, ip, id: clientId, request: { method: "PUT", url, body } };
	}

	const response = await legacyRequest({ endpoint: "client_update", method: "PUT", data: body, variables: { id: clientId } });
	return {
		ok: response?.meta?.rc === "ok",
		mac: normalizedMac,
		ip,
		id: clientId,
		response
	};
}
