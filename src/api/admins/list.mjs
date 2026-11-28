/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/admins/list.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:02-08:00 (1795870562)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { legacyRead } from "../../lib/crud.mjs";

/**
 * @fileoverview `admins.list()` — the site's controller login accounts (not RADIUS):
 * `v2/api/site/{site}/user` on UniFi OS, `api/s/{site}/rest/admin` on a
 * standalone legacy controller. Legacy-only — the official Integration API
 * exposes no admin management.
 *
 * @returns {Promise<object[]>} the rows as the legacy controller answers them
 * @throws {CapabilityError} when the legacy path is unavailable
 */
export default async function list() {
	return legacyRead("admins", "admin_list");
}
