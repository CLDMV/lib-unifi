/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/clients/list.mjs
 *	@Date: 2026-11-28T03:07:00-07:00 (1795860420)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Shinrai <CLDMV> (git+npm@cldmv.net)
 *	@Last modified time: 2026-11-28T03:44:10-08:00 (1795866250)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { self } from "@cldmv/slothlet/runtime";
import { CapabilityError, ValidationError } from "../../lib/errors.mjs";
import { officialList, resolveOfficialSiteId } from "../../lib/transport/official.mjs";
import { legacyRequest, envelopeData } from "../../lib/transport/request.mjs";
import { officialClientFromRow, legacyClientFromStaRow, legacyClientRecordFromUserRow } from "../../lib/normalize/client.mjs";

/**
 * @fileoverview `clients.list({ active })` — the controller's clients,
 * normalized onto `client { mac, ip, hostname, network, fixed, active }`.
 *
 * `active: true` (the default) reads the connected clients: `stat/sta` on the
 * legacy path, the Integration API's clients page on the official path.
 * `active: false` additionally merges the legacy `rest/user` client records
 * (fixed IPs, offline clients) — an official-only deployment does not carry an
 * all-clients read, so `active: false` throws there.
 *
 * @param {{ active?: boolean }} [options]
 * @returns {Promise<object[]>}
 * @throws {CapabilityError} when neither path can serve the read
 * @throws {ValidationError} on a bad option
 */
export default async function list(options = {}) {
	const active = options.active !== false;
	if (typeof active !== "boolean") {
		throw new ValidationError("VALIDATION_ACTIVE", "clients.list takes { active: boolean }");
	}

	const caps = await self.capabilities();
	const clients = [];
	if (caps.clients === "official") {
		const siteId = caps.site ?? (await resolveOfficialSiteId());
		const rows = await officialList(`/sites/${encodeURIComponent(siteId)}/clients`, { idOf: (client) => client?.id });
		for (const row of rows) {
			const client = officialClientFromRow(row);
			if (client) clients.push(client);
		}
		if (!active) {
			throw new CapabilityError(
				"CAPABILITY_UNAVAILABLE",
				"clients.list({ active: false }) needs the legacy client records; the official Integration API only carries connected clients",
				{
					capability: "clients",
					hint: "pass legacy credentials to createUnifi for the offline client records"
				}
			);
		}
		return clients;
	}
	if (caps.clients === "legacy") {
		const staBody = await legacyRequest({ endpoint: "client_list", method: "GET" });
		for (const row of Array.isArray(staBody) ? staBody : envelopeData(staBody)) {
			const client = legacyClientFromStaRow(row);
			if (client) clients.push(client);
		}
		if (!active) {
			const recordsBody = await legacyRequest({ endpoint: "client_records", method: "GET" });
			const seen = new Set(clients.map((client) => client.mac));
			for (const row of Array.isArray(recordsBody) ? recordsBody : envelopeData(recordsBody)) {
				const record = legacyClientRecordFromUserRow(row);
				if (record && !seen.has(record.mac)) clients.push(record);
			}
		}
		return clients;
	}
	throw new CapabilityError(
		"CAPABILITY_UNAVAILABLE",
		"no clients surface: neither the official Integration API nor the legacy controller API answered the probe",
		{
			capability: "clients",
			hint: "give createUnifi an apiKey or legacy credentials the controller accepts"
		}
	);
}
