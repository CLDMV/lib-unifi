# API coverage inventory

Every UniFi **Network** endpoint this library covers — the official Integration API surface (the published reference, developer.ui.com, network **v11.0.97**, 73 operations) and every legacy controller endpoint unifi-cli carries (`lib/api/map/map.mjs` and the older `lib/endpointMap.mjs`, merged into `src/lib/endpoints.mjs`). One row per endpoint: the area, the official path, the lib-unifi leaf, and the status.

Scope decisions (the full-scope direction): the whole Network application is in — sites, networks, WLANs, clients, devices (APs, switches, gateways), firewall, DNS, RADIUS, admins, VPN, WAN, switching, hotspot, DPI. **Protect cameras and NVRs are out of scope** for this version (their legacy rows stay in the endpoint table so a later version lifts them). Anything in neither unifi-cli nor the official API is skipped and listed below.

Fallback rule: a leaf prefers the official Integration API and falls back to the legacy controller API where unifi-cli covers the row; every dual-path leaf has official-absent / 401 / collection-404 → legacy tests (`tests/fallback.test.vitest.mjs`), and every write takes `{ dryRun: true }` (`tests/dryrun.test.vitest.mjs`).

Numbers: **73 official operations — 72 implemented, 1 skipped** (the reasons are on the rows); **19 legacy rows** — 17 implemented, 2 skipped.

## Sites

| official path   | lib-unifi leaf | status |
| --------------- | -------------- | ------ |
| `GET /v1/sites` | `sites.list`   | done   |

## Networks / VLANs

| official path                                            | lib-unifi leaf                             | status                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `GET /v1/sites/{siteId}/networks`                        | `networks.list`                            | done                                                                                                                        |
| `POST /v1/sites/{siteId}/networks`                       | `networks.create`                          | done                                                                                                                        |
| `GET /v1/sites/{siteId}/networks/{networkId}`            | `networks.list (detail fetch per network)` | done                                                                                                                        |
| `PUT /v1/sites/{siteId}/networks/{networkId}`            | `networks.update`                          | done                                                                                                                        |
| `DELETE /v1/sites/{siteId}/networks/{networkId}`         | `networks.delete`                          | done                                                                                                                        |
| `GET /v1/sites/{siteId}/networks/{networkId}/references` | `—`                                        | **skipped** — a reference-count helper for UI prompts; no Digby consumer, and nothing else in the official surface needs it |

## WLANs (wifi/broadcasts)

| official path                                                 | lib-unifi leaf | status |
| ------------------------------------------------------------- | -------------- | ------ |
| `GET /v1/sites/{siteId}/wifi/broadcasts`                      | `wlans.list`   | done   |
| `POST /v1/sites/{siteId}/wifi/broadcasts`                     | `wlans.create` | done   |
| `GET /v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}`    | `wlans.get`    | done   |
| `PUT /v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}`    | `wlans.update` | done   |
| `DELETE /v1/sites/{siteId}/wifi/broadcasts/{wifiBroadcastId}` | `wlans.delete` | done   |

## Clients

| official path                                        | lib-unifi leaf                                        | status                                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /v1/sites/{siteId}/clients`                     | `clients.list`                                        | done — enriched from the legacy rest/user records when both paths serve (fixed IPs, network names) |
| `GET /v1/sites/{siteId}/clients/{clientId}`          | `clients.get`                                         | done                                                                                               |
| `POST /v1/sites/{siteId}/clients/{clientId}/actions` | `clients.guest.authorize / clients.guest.unauthorize` | done                                                                                               |

## Devices (APs, switches, gateways)

| official path                                                                   | lib-unifi leaf              | status                                   |
| ------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------- |
| `GET /v1/sites/{siteId}/devices`                                                | `devices.list`              | done                                     |
| `POST /v1/sites/{siteId}/devices`                                               | `devices.adopt`             | done                                     |
| `GET /v1/sites/{siteId}/devices/{deviceId}`                                     | `devices.get`               | done                                     |
| `DELETE /v1/sites/{siteId}/devices/{deviceId}`                                  | `devices.forget`            | done                                     |
| `POST /v1/sites/{siteId}/devices/{deviceId}/actions`                            | `devices.action`            | **skipped** — the one documented action) |
| `POST /v1/sites/{siteId}/devices/{deviceId}/interfaces/ports/{portIdx}/actions` | `devices.port.action`       | **skipped** — the one documented action) |
| `GET /v1/sites/{siteId}/devices/{deviceId}/statistics/latest`                   | `devices.statistics.latest` | done                                     |
| `GET /v1/sites/{siteId}/device-tags`                                            | `devices.tags.list`         | done                                     |
| `GET /v1/pending-devices`                                                       | `devices.pending.list`      | done                                     |

## Firewall

| official path                                                              | lib-unifi leaf                   | status |
| -------------------------------------------------------------------------- | -------------------------------- | ------ |
| `GET /v1/sites/{siteId}/firewall/policies`                                 | `firewall.policies.list`         | done   |
| `POST /v1/sites/{siteId}/firewall/policies`                                | `firewall.policies.create`       | done   |
| `GET /v1/sites/{siteId}/firewall/policies/ordering`                        | `firewall.policies.ordering.get` | done   |
| `PUT /v1/sites/{siteId}/firewall/policies/ordering`                        | `firewall.policies.ordering.set` | done   |
| `GET /v1/sites/{siteId}/firewall/policies/{firewallPolicyId}`              | `firewall.policies.get`          | done   |
| `PUT /v1/sites/{siteId}/firewall/policies/{firewallPolicyId}`              | `firewall.policies.update`       | done   |
| `PATCH /v1/sites/{siteId}/firewall/policies/{firewallPolicyId}`            | `firewall.policies.patch`        | done   |
| `DELETE /v1/sites/{siteId}/firewall/policies/{firewallPolicyId}`           | `firewall.policies.delete`       | done   |
| `GET /v1/sites/{siteId}/firewall/zones`                                    | `firewall.zones.list`            | done   |
| `POST /v1/sites/{siteId}/firewall/zones`                                   | `firewall.zones.create`          | done   |
| `GET /v1/sites/{siteId}/firewall/zones/{firewallZoneId}`                   | `firewall.zones.get`             | done   |
| `PUT /v1/sites/{siteId}/firewall/zones/{firewallZoneId}`                   | `firewall.zones.update`          | done   |
| `DELETE /v1/sites/{siteId}/firewall/zones/{firewallZoneId}`                | `firewall.zones.delete`          | done   |
| `GET /v1/sites/{siteId}/acl-rules`                                         | `firewall.acl.list`              | done   |
| `POST /v1/sites/{siteId}/acl-rules`                                        | `firewall.acl.create`            | done   |
| `GET /v1/sites/{siteId}/acl-rules/ordering`                                | `firewall.acl.ordering.get`      | done   |
| `PUT /v1/sites/{siteId}/acl-rules/ordering`                                | `firewall.acl.ordering.set`      | done   |
| `GET /v1/sites/{siteId}/acl-rules/{aclRuleId}`                             | `firewall.acl.get`               | done   |
| `PUT /v1/sites/{siteId}/acl-rules/{aclRuleId}`                             | `firewall.acl.update`            | done   |
| `DELETE /v1/sites/{siteId}/acl-rules/{aclRuleId}`                          | `firewall.acl.delete`            | done   |
| `GET /v1/sites/{siteId}/traffic-matching-lists`                            | `firewall.matching.list`         | done   |
| `POST /v1/sites/{siteId}/traffic-matching-lists`                           | `firewall.matching.create`       | done   |
| `GET /v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}`    | `firewall.matching.get`          | done   |
| `PUT /v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}`    | `firewall.matching.update`       | done   |
| `DELETE /v1/sites/{siteId}/traffic-matching-lists/{trafficMatchingListId}` | `firewall.matching.delete`       | done   |

## DNS

| official path                                          | lib-unifi leaf       | status |
| ------------------------------------------------------ | -------------------- | ------ |
| `GET /v1/sites/{siteId}/dns/policies`                  | `dns.records.list`   | done   |
| `POST /v1/sites/{siteId}/dns/policies`                 | `dns.records.create` | done   |
| `GET /v1/sites/{siteId}/dns/policies/{dnsPolicyId}`    | `dns.records.get`    | done   |
| `PUT /v1/sites/{siteId}/dns/policies/{dnsPolicyId}`    | `dns.records.update` | done   |
| `DELETE /v1/sites/{siteId}/dns/policies/{dnsPolicyId}` | `dns.records.delete` | done   |

## RADIUS

| official path                            | lib-unifi leaf         | status |
| ---------------------------------------- | ---------------------- | ------ |
| `GET /v1/sites/{siteId}/radius/profiles` | `radius.profiles.list` | done   |

## VPN

| official path                                     | lib-unifi leaf     | status |
| ------------------------------------------------- | ------------------ | ------ |
| `GET /v1/sites/{siteId}/vpn/servers`              | `vpn.servers.list` | done   |
| `GET /v1/sites/{siteId}/vpn/site-to-site-tunnels` | `vpn.tunnels.list` | done   |

## WAN

| official path                 | lib-unifi leaf | status |
| ----------------------------- | -------------- | ------ |
| `GET /v1/sites/{siteId}/wans` | `wan.list`     | done   |

## Switching

| official path                                                     | lib-unifi leaf          | status |
| ----------------------------------------------------------------- | ----------------------- | ------ |
| `GET /v1/sites/{siteId}/switching/lags`                           | `switching.lags.list`   | done   |
| `GET /v1/sites/{siteId}/switching/lags/{lagId}`                   | `switching.lags.get`    | done   |
| `GET /v1/sites/{siteId}/switching/mc-lag-domains`                 | `switching.mclag.list`  | done   |
| `GET /v1/sites/{siteId}/switching/mc-lag-domains/{mcLagDomainId}` | `switching.mclag.get`   | done   |
| `GET /v1/sites/{siteId}/switching/switch-stacks`                  | `switching.stacks.list` | done   |
| `GET /v1/sites/{siteId}/switching/switch-stacks/{switchStackId}`  | `switching.stacks.get`  | done   |

## Hotspot (vouchers)

| official path                                            | lib-unifi leaf                | status |
| -------------------------------------------------------- | ----------------------------- | ------ |
| `GET /v1/sites/{siteId}/hotspot/vouchers`                | `hotspot.vouchers.list`       | done   |
| `POST /v1/sites/{siteId}/hotspot/vouchers`               | `hotspot.vouchers.create`     | done   |
| `DELETE /v1/sites/{siteId}/hotspot/vouchers`             | `hotspot.vouchers.delete()`   | done   |
| `GET /v1/sites/{siteId}/hotspot/vouchers/{voucherId}`    | `hotspot.vouchers.get`        | done   |
| `DELETE /v1/sites/{siteId}/hotspot/vouchers/{voucherId}` | `hotspot.vouchers.delete(id)` | done   |

## DPI

| official path              | lib-unifi leaf          | status |
| -------------------------- | ----------------------- | ------ |
| `GET /v1/dpi/applications` | `dpi.applications.list` | done   |
| `GET /v1/dpi/categories`   | `dpi.categories.list`   | done   |

## Reference (countries, info)

| official path       | lib-unifi leaf                  | status |
| ------------------- | ------------------------------- | ------ |
| `GET /v1/countries` | `countries.list`                | done   |
| `GET /v1/info`      | `capabilities (official probe)` | done   |

## The legacy controller endpoint rows

| legacy endpoint row (endpoint-table key)                                      | lib-unifi leaf                                                           | status                                                                                              |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `stat/sites (sites_list)`                                                     | `sites.list`                                                             | done                                                                                                |
| `api/s/{site}/stat/sysinfo (site_info, unifi_os_v1 row)`                      | `capabilities (legacy probe)`                                            | done                                                                                                |
| `api/s/{site}/stat/device (device_list)`                                      | `devices.list`                                                           | done                                                                                                |
| `api/s/{site}/stat/device/{id} (device_detail)`                               | `devices.get`                                                            | done                                                                                                |
| `api/s/{site}/stat/device (device_stat)`                                      | `devices.statistics.list`                                                | done                                                                                                |
| `api/s/{site}/stat/sta (client_list)`                                         | `clients.list`                                                           | done                                                                                                |
| `api/s/{site}/stat/user/{id} (client_detail)`                                 | `clients.get`                                                            | done                                                                                                |
| `api/s/{site}/rest/user (client_records)`                                     | `clients.list({ active: false }) / clients.fixed.ip.set (id resolution)` | done                                                                                                |
| `api/s/{site}/rest/user/{id} (client_update)`                                 | `clients.fixed.ip.set`                                                   | done — legacy-only write; the official Integration API carries no fixed-IP write                    |
| `api/s/{site}/rest/networkconf (network_config)`                              | `networks.list`                                                          | done                                                                                                |
| `api/s/{site}/rest/networkconf/{id} (network_config_update)`                  | `networks.update`                                                        | done                                                                                                |
| `v2/api/site/{site}/static-dns · rest/static-dns (static_dns_*)`              | `dns.records.list · dns.forward.list/set`                                | done — the generic record writes are official-only (see the DNS row)                                |
| `v2/api/site/{site}/radius/users · rest/radiususer · rest/account (radius_*)` | `radius.users list/create/update/delete`                                 | done — the batch shapes follow unifi-cli's tasks/radius-sync.mjs                                    |
| `v2/api/site/{site}/user · rest/admin (admin_list)`                           | `admins.list`                                                            | done                                                                                                |
| `v2/api/site/{site}/user/{id} (admin_detail)`                                 | `admins.get`                                                             | done — UniFi OS v2 surface only (the legacy table carries the list row only)                        |
| `api/s/{site}/rest/portconf (port_config)`                                    | `switching.ports.list`                                                   | done                                                                                                |
| `v2/api/site/{site}/device (device_list_mini)`                                | `—`                                                                      | skipped — the slim inventory page the official /devices read supersedes; the row stays in the table |
| `api/bootstrap · v2/api/site/{site}/info (protect site_info)`                 | `capabilities (the Protect/NVR detection probes)`                        | done — detection only                                                                               |
| `api/cameras/{id} (camera_patch) · camera_reboot · camera_resolution_scale_*` | `—`                                                                      | skipped — Protect is out of scope for this version (the rows stay in the table per PLAN §6.2)       |

## Areas with no endpoints on either surface

| area                    | status                       | why                                                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Routing (static routes) | **skipped**                  | The Integration API v11 carries no routing endpoints and unifi-cli covers none; when a surface appears, it lifts into `src/api/routing/`                                                                                                                                              |
| Port forwarding         | **skipped**                  | No official endpoint in v11 and no unifi-cli row (unifi-cli's `port_config` is switch port profiles, not port forwarding)                                                                                                                                                             |
| Events / alarms         | **skipped**                  | No official endpoint in v11 and no unifi-cli row                                                                                                                                                                                                                                      |
| DHCP (as its own area)  | **covered through networks** | DHCP has no dedicated endpoints on either surface: the DHCP server, range, leases and DNS overrides ride the network config (`rest/networkconf`'s `dhcpd_*` on legacy, `ipv4Configuration.dhcpConfiguration` on official) — all reachable through `networks.list` / `networks.update` |
| Protect (cameras, NVRs) | **skipped (later version)**  | The Protect application has its own API surface; the legacy `camera_*` rows stay in `src/lib/endpoints.mjs` per PLAN §6.2                                                                                                                                                             |
