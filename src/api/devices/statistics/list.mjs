/**
 *
 *	@Project: @cldmv/lib-unifi
 *	@Filename: src/api/devices/statistics/list.mjs
 *	@Date: 2026-11-28T04:46:07-08:00 (1795869967)
 *	@Author: Shinrai <CLDMV>
 *	@Email: <git+npm@cldmv.net>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-28T04:56:03-08:00 (1795870563)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { legacyRead } from "../../../lib/crud.mjs";

/**
 * @fileoverview `devices.statistics.list()` — per-device operational statistics, the
 * legacy `stat/device` stat rows (cpu, mem, uptime, tx/rx rates, radio
 * stats). The official Integration API has no all-devices statistics listing
 * (it carries the per-device latest snapshot — `devices.statistics.latest`),
 * so this read is legacy-only.
 *
 * @returns {Promise<object[]>} the rows as the legacy controller answers them
 * @throws {CapabilityError} when the legacy path is unavailable
 */
export default async function list() {
	return legacyRead("devices", "device_stat");
}
