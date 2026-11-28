/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/devices/pending/list.mjs
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

import { officialRead } from "../../../lib/crud.mjs";

/**
 * @fileoverview `devices.pending.list()` — devices awaiting adoption (the Integration
 * API's pending-devices collection: macAddress, model, ipAddress, state,
 * adoptionTargetSiteIds). Official-only — a legacy controller's pending
 * devices are not a row unifi-cli carries.
 *
 * @returns {Promise<object[]>} the collection as the official Integration API
 *   answers it (each page merged; the rows are the API's own shape)
 * @throws {CapabilityError} when the official surface is unavailable
 */
export default async function list() {
	return officialRead("devices", "pending-devices", { topLevel: true, idOf: (item) => item?.macAddress ?? item?.id });
}
