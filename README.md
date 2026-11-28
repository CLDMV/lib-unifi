# @cldmv/lib-unifi

UniFi Network client library — one interface over the official UniFi Integration API and the legacy controller API, with a capability probe and dry-run writes. A slothlet API package: `createUnifi` composes the library's own slothlet instance over the package's `api/` and returns that api — the returned object **is** the library's slothlet api. Credentials and config enter through the factory and stay inside the library's own instance (per-instance credential isolation), so any project can use the library. It owns the protocol only — no policy, no Digby concepts.

It covers the whole UniFi **Network** application (Protect cameras and NVRs are out of scope for now — see `docs/api-coverage.md` for the full endpoint inventory and what is skipped):

```js
import { createUnifi } from "@cldmv/lib-unifi";
const unifi = await createUnifi({
	baseUrl: "https://10.0.0.1",
	fetch, // the fetch the library uses; it never opens sockets itself
	credentials: { apiKey, legacy: { username, password } }, // plain values — or a getter/promise, resolved once at compose time
	tls: { spkiPins } // counted on the capabilities report; pinning itself is the injected fetch's business
});
await unifi.capabilities(); // { networks, clients, fixedIp, dns: { records, forward }, official, officialError, tls, version, … }
await unifi.networks.list(); // every network/VLAN: id, name, vlan, cidr, gateway, dhcp { range, leaseSec }, dns { servers, domain }, kind
await unifi.networks.update(id, { dns: ["10.0.1.166"], domain: "homelab.example.com" });
await unifi.clients.list({ active: true }); // mac, ip, hostname, network, fixed — the official list is enriched from the legacy records when both paths serve
await unifi.clients.fixed.ip.set("00:00:5e:00:53:01", "192.0.2.10"); // resolves the MAC to the controller _id first
await unifi.dns.records.list();
await unifi.dns.forward.set({ domain, target }); // the Forward Domain rules
await unifi.devices.list(); // APs, switches, gateways (legacy stat/device or the Integration API)
await unifi.firewall.policies.list(); // the Integration API's firewall surface (zones, ACL rules, traffic matching lists)
await unifi.radius.users.list(); // RADIUS user accounts (legacy surface; profiles on the official one)
await unifi.admins.list(); // controller login accounts (legacy surface)
await unifi.sites.list(); // every site, normalized
```

Every write takes `{ dryRun: true }` and answers the change it would make — `{ dryRun: true, capability, request: { method, url, body } }` — without sending anything, and never carries credentials in the answer.

## The two API paths

The **official Integration API** (`/proxy/network/integration/v1`, an API key created on the console, `X-API-KEY` header) is preferred: sites resolve to their UUID, networks read through `/sites/{siteId}/networks` with the DHCP DNS override in `ipv4Configuration.dhcpConfiguration.dnsServerIpAddressesOverride`, DNS records are `/sites/{siteId}/dns/policies` policies — `FORWARD_DOMAIN` is one of its types — and the firewall, WLAN, device, VPN, WAN, switching and hotspot surfaces are official-only collections. The **legacy controller API** (a local account login: UniFi OS `POST /api/auth/login` with the session cookie and CSRF token, falling back to the legacy `POST /api/login` on `:8443` with the `unifises` cookie) fills in what the official API cannot do: `rest/networkconf` network configs, `stat/sta` clients, the fixed-IP write `PUT rest/user/{id}`, the static-DNS collection (`v2/api/site/{site}/static-dns` on UniFi OS, `api/s/{site}/rest/static-dns` on older controllers), RADIUS user accounts, admin accounts, switch port profiles, and the `stat/device` inventory.

`capabilities()` probes both and classifies each capability `official | legacy | none`. `dns.forward` is `official` when the official policies endpoint answers (Forward Domain is a policy type there), `legacy` when the legacy static-DNS collection answers **and** the Network application version is known to be 9 or later (Forward Domain needs 9.x), `none` otherwise. The fixed-IP write and the RADIUS/admin/port-profile reads are legacy-only capabilities. The report also says whether the official surface is usable at all (`official`), why not when it isn't (`officialError` — a refused API key is never silent), and how many SPKI pins were configured (`tls.spkiPins`). Neither credential is required at compose time — a dry-run-only caller may compose first; reads and sends fail with typed errors until one path has credentials.

**TLS pinning lives in the caller's fetch.** The library never opens sockets itself, so a caller that needs SPKI pinning binds it into the fetch it hands in; `tls.spkiPins` is only counted on the capability report (the values are not stored or reported anywhere).

## Errors

Credentials never leak: the API key and the legacy account are sealed into a module-private vault that only the transports read — the composed context carries non-secret config only, so nothing the returned api exposes (`context.get()`, `JSON.stringify`, `util.inspect`) reaches a credential value. They are never logged, never put in error messages or thrown objects (an auth failure's error names URLs, not values), never written to disk, and dry-run answers carry no credentials and no session headers. `credentials` may also arrive as a function (sync or async) or a promise — resolved once when the instance composes; nothing is ever read from the environment.

Every failure is a typed error from `src/lib/errors.mjs` — `ConfigError` (factory config), `AuthError` (legacy login; both attempts reported), `ApiError` (a non-2xx answer; carries the controller's own code), `TransportError` (fetch failures, untrustworthy list pages), `CapabilityError` (the probed capability is unavailable, with a fix-step hint), `ValidationError` (a bad MAC, IP, domain or patch). `isUnifiError(err, code?)` is the type guard. The library never exits the process.

Requests time out: `timeoutMs` (default 10 s) bounds every read and write, `loginTimeoutMs` (default 8 s) the login attempts, via `AbortSignal.timeout` on each fetch — a hung controller fails a call instead of hanging it.

## Requirements

Node.js `>=24.15.0` at runtime (`engines`) and for the dev toolchain (`devEngines`) — the same floor the CJS shim's `require(esm)` entry needs. From CommonJS:

```js
const createUnifi = require("@cldmv/lib-unifi"); // the factory itself (single-export unwrap)
// or: const { createUnifi } = require("@cldmv/lib-unifi");
```

## In a checkout

Tests run against `src/` through the `lib-unifi-dev` condition (set it once per shell with `export NODE_OPTIONS=--conditions=lib-unifi-dev`, or let the vitest config set it for the workers):

| Run                                                    | Resolves to                                            |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `node app.mjs`                                         | `dist/index.mjs` (`ERR_MODULE_NOT_FOUND` if not built) |
| `NODE_OPTIONS=--conditions=lib-unifi-dev node app.mjs` | `src/index.mjs`                                        |

`npm test` and `npm run coverage` go through `@cldmv/vitest-runner` (`tests/run-vitest.mjs`); the composed-leaf coverage is measured through the query-stripping provider in `.configs/coverage-provider.mjs`. `npm run build` builds `dist/` one file per module (slothlet scans the `api/` tree at runtime, so the build keeps it) and copies `src/index.cjs` verbatim; `npm run test:cjs` composes the built package and `npm run test:dist` runs the vitest suite against `dist/` (`prepack` builds before `npm pack`). Fixtures under `tests/fixtures/` are hand-written from UniFi's published documentation and unifi-cli's source — each fixture's `_source` field names where its shapes come from; no fixture is captured from a live controller. `tests/recorder.mjs` is the maintainer-only helper that reads a live controller and writes scrubbed answers to the gitignored `tmp/fixtures-recorded/` — the committed fixtures stay hand-written, and nothing recorded is ever committed.

## License

Apache-2.0 — see [LICENSE](LICENSE).
