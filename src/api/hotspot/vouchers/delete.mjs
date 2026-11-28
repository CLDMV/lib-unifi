/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/hotspot/vouchers/delete.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:04-08:00 (1795870564)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { officialWrite } from "../../../lib/crud.mjs";

/**
 * @fileoverview `hotspot.vouchers.delete([id], options)` — delete one voucher
 * by id, or every voucher when no id is given (the collection DELETE answers
 * how many were deleted). Official-only.
 *
 * @param {string} [id] the voucher id; omit to delete every voucher
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} `{ ok: true, capability: "official", response }`, or the
 *   dry-run description — a dry run sends nothing
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function run(id, options = {}) {
	if (typeof id === "object" && id !== null && !Array.isArray(id)) {
		options = id;
		id = undefined;
	}
	return officialWrite(
		"hotspot.vouchers",
		{ method: "DELETE", relative: id ? "hotspot/vouchers/{id}" : "hotspot/vouchers", vars: id ? { id } : {}, body: null },
		options
	);
}
