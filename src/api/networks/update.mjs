/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/networks/update.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:11-08:00 (1795866251)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { CapabilityError, ValidationError } from "../../lib/errors.mjs";
import { officialRequest, officialUrl, resolveOfficialSiteId } from "../../lib/transport/official.mjs";
import { legacyRequest, legacyUrl } from "../../lib/transport/request.mjs";
import { officialNetworkUpdateBody, legacyNetworkUpdateBody } from "../../lib/normalize/network.mjs";
import { isIpv4 } from "../../lib/normalize/client.mjs";

/**
 * @fileoverview `networks.update(id, patch, options)` — the normalised
 * `network.dns.set` write: the DHCP DNS servers and/or the search domain a
 * network hands out.
 *
 * `patch` is `{ dns?: string[]|null, domain?: string|null }`. An empty or null
 * `dns` stops the custom servers (the gateway hands out itself); a null
 * `domain` clears the search domain.
 *
 * Every write takes `{ dryRun: true }` and answers the change it would make:
 * `{ dryRun: true, capability, request: { method, url, body } }`. Dry-run
 * answers never carry credentials — the request's headers are not included.
 *
 * @param {string} id the network id (`network.id` from `networks.list()`)
 * @param {{ dns?: string[]|null, domain?: string|null }} patch
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok, capability, id, changed }`, or the dry-run
 *   request description
 * @throws {CapabilityError} when neither path can serve the write
 * @throws {ValidationError} on a bad id or patch
 */
export default async function update(id, patch = {}, options = {}) {
	if (typeof id !== "string" || id.trim() === "") {
		throw new ValidationError("VALIDATION_ID_REQUIRED", "networks.update needs the network id");
	}
	const { dns, domain } = patch ?? {};
	if (dns !== undefined && dns !== null && !Array.isArray(dns)) {
		throw new ValidationError(
			"VALIDATION_DNS_LIST",
			"patch.dns must be an array of server IPs, or null to stop handing custom servers out"
		);
	}
	if (Array.isArray(dns)) {
		for (const server of dns) {
			if (typeof server !== "string" || !isIpv4(server)) {
				throw new ValidationError("VALIDATION_DNS_SERVER", `patch.dns entries must be IPv4 addresses, got ${JSON.stringify(server)}`);
			}
		}
	}
	if (domain !== undefined && domain !== null && (typeof domain !== "string" || domain.trim() === "")) {
		throw new ValidationError("VALIDATION_DOMAIN", "patch.domain must be a non-empty string, or null to clear it");
	}
	const changed = {};
	if (dns !== undefined) changed.dns = Array.isArray(dns) ? [...dns] : dns;
	if (domain !== undefined) changed.domain = domain;

	const caps = await self.capabilities();
	if (caps.networks === "official") {
		const siteId = caps.site ?? (await resolveOfficialSiteId());
		const path = `/sites/${encodeURIComponent(siteId)}/networks/${encodeURIComponent(id)}`;
		const detail = await officialRequest({ method: "GET", path });
		const body = officialNetworkUpdateBody(detail, { dns, domain });
		if (options.dryRun) {
			return { dryRun: true, capability: "official", request: { method: "PUT", url: officialUrl(path), body } };
		}
		await officialRequest({ method: "PUT", path, body });
		return { ok: true, capability: "official", id, changed };
	}
	if (caps.networks === "legacy") {
		const body = legacyNetworkUpdateBody({ dns, domain });
		if (options.dryRun) {
			return { dryRun: true, capability: "legacy", request: { method: "PUT", url: legacyUrl("network_config_update", { id }), body } };
		}
		const response = await legacyRequest({ endpoint: "network_config_update", method: "PUT", data: body, variables: { id } });
		const ok = response?.meta?.rc === "ok";
		return { ok, capability: "legacy", id, changed, response };
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no networks write surface: neither the official Integration API nor the legacy controller API answered the probe",
		{
			capability: "networks",
			hint: "give createUnifi an apiKey or legacy credentials the controller accepts"
		}
	);
}
