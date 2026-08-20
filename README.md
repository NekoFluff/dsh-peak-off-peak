# dsh-peak-off-peak

A [DeepSeek Harness](https://deepseek.com/harness/en/) plugin that shows a
badge in the Web UI sidebar footer indicating whether the **DeepSeek API** is
currently in **peak** or **off-peak** hours.

- 🔴 **Peak** — full rate
- 🟢 **Off-peak** — half rate

## The rule

Peak hours are **01:00–04:00** and **06:00–10:00 UTC**; every other hour is
off-peak. Off-peak rates are half of peak rates.

Source (authoritative, may change over time — see "Updating the window"):
<https://api-docs.deepseek.com/quick_start/pricing/>

The badge is computed from the browser's clock in **UTC**, so it is correct in
every timezone and flips automatically every 30 seconds.

## Layout

```
dsh-peak-off-peak/
├── package.json       # dsh.bundle (the config layer) + dsh.client (the UI)
├── cordis.patch.yml   # the patch: inserts the plugin row
├── index.js           # node half (host) — no-op, so the row activates
├── client.js          # browser half — renders the sidebar badge
└── README.md
```

This is a **bundle**: an npm package that ships a configuration layer
(`dsh.bundle.patch`) plus a client plugin (`dsh.client`). It is a single
package that is both — the one package's patch inserts its own row.

## Install

Requires the `dsh` CLI and [pnpm](https://pnpm.io/installation).

### From a local checkout (this folder)

```sh
dsh plugin --profile web add ./dsh-peak-off-peak
```

Then restart the web UI:

```sh
dsh web
```

The badge appears at the bottom of the left sidebar, next to Settings.

### From Git (reuse on other devices)

```sh
dsh plugin --profile web add github:you/dsh-peak-off-peak
```

### From npm (reuse on other devices, cleanest)

```sh
npm publish          # from inside this folder
dsh plugin --profile web add dsh-peak-off-peak
```

## How it works

1. `package.json` declares two things under `dsh`:
   - `dsh.bundle.patch` → `cordis.patch.yml`, so `dsh plugin add` treats this
     package as a config layer and appends it to the profile's bundle list.
   - `dsh.client` (`platform: web`, `inject: ["slots"]`), so the client-modules
     host discovers it as a browser plugin and serves `client.js`.
2. `cordis.patch.yml` inserts one row, `id: peak-off-peak`, whose `name` is the
   package itself. That loads `index.js` (the node half) as a host row.
3. `client.js` registers a React component into the `sidebar.footer.action`
   slot via `ctx.slots.inject(...)`. That slot is additive, so the badge sits
   next to Settings instead of replacing anything.
4. The component reads the current UTC time, tests it against the two peak
   windows, and re-checks every 30 seconds.

## Updating the window

DeepSeek may change the peak/off-peak schedule. Edit the `PEAK_WINDOWS` array at
the top of `client.js` (entries are `[startHour, endHour)` in UTC), reinstall,
and reload.

## Reuse across devices

A folder on one machine does not sync to others. To reuse it elsewhere, ship it
one of three ways:

1. **npm** — `npm publish`, then `dsh plugin add dsh-peak-off-peak` anywhere
   (ships prebuilt code; no build step on install).
2. **Git** — `dsh plugin add github:you/dsh-peak-off-peak`. Because this plugin
   is plain JavaScript (no TypeScript build step), a git install works directly;
   pin a commit (`#<sha>`) if you want to freeze it.
3. **Tarball** — `pnpm pack`, then `dsh plugin add ./dsh-peak-off-peak-0.1.0.tgz`.

This plugin is deliberately plain `.js`, so it needs no `prepare` build script
and no pnpm `allowBuilds` approval — which is the simplest path for a git-based
install.
