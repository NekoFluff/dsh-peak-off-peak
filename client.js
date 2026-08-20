// Browser half of the dsh-peak-off-peak plugin.
//
// This file is served to the browser as /plugins/dsh-peak-off-peak/client.js
// and executes through the client module loader. It registers a React
// component into the `sidebar.footer.action` slot, so the peak/off-peak badge
// appears at the sidebar foot next to Settings.
//
// It only `require`s platform static modules ("react" and the shell's UI
// primitives), so it has no plugin dependencies of its own.
window.__ModuleLoader__.load({
	id: "dsh-peak-off-peak",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const { useState, useEffect } = React;

		// The shell answers `@deepseek-ai/dsh-client-ui-primitives` from the same
		// static-module table that answers "react", so the hover card can reuse the
		// shell's own Tooltip: a fixed-position bubble that no sidebar ancestor can
		// clip, with the platform's tooltip colors and animation. If a future shell
		// drops the export, the badge degrades to the native `title` tooltip with
		// the same text.
		const Tooltip = (() => {
			try {
				const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
				return typeof primitives.Tooltip === "function" ? primitives.Tooltip : null;
			} catch (error) {
				return null;
			}
		})();

		// Peak windows in UTC, from https://api-docs.deepseek.com/quick_start/pricing/ :
		//   "Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC
		//    (all other hours are off-peak). Off-peak rates are half of the peak rates."
		// Each entry is [startHour, endHour), so e.g. [1, 4] covers 01:00 <= t < 04:00.
		const PEAK_WINDOWS = [
			[1, 4],
			[6, 10]
		];

		const PEAK_COLOR = "#e5484d";
		const OFF_PEAK_COLOR = "#2f9e44";

		const HOUR_MS = 3600000;
		const DAY_MS = 86400000;

		function pad(value) {
			return String(value).padStart(2, "0");
		}

		/**
		 * Every peak window as absolute instants around `now` (yesterday through the
		 * day after tomorrow, so an active window that began before midnight UTC and
		 * the next one after it are both present), sorted and merged on the timeline.
		 * Merging is what keeps "how long is left" honest when windows touch — either
		 * because they were authored back-to-back or because one ends where the next
		 * day's begins.
		 */
		function occurrences(now) {
			const base = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
			const spans = [];
			for (let day = -1; day <= 2; day++) {
				const dayStart = base + day * DAY_MS;
				for (const [start, end] of PEAK_WINDOWS) {
					if (end <= start) continue;
					spans.push({ start: dayStart + start * HOUR_MS, end: dayStart + end * HOUR_MS });
				}
			}
			spans.sort((a, b) => a.start - b.start);
			const merged = [];
			for (const span of spans) {
				const last = merged[merged.length - 1];
				if (last !== undefined && span.start <= last.end) last.end = Math.max(last.end, span.end);
				else merged.push({ start: span.start, end: span.end });
			}
			return merged;
		}

		/**
		 * Current rate plus the next flip: `boundary` is when the state changes and
		 * `until` is how far away that is (null when no window is configured).
		 */
		function statusAt(now) {
			const t = now.getTime();
			const spans = occurrences(now);
			const active = spans.find((span) => t >= span.start && t < span.end);
			if (active !== undefined) {
				return {
					peak: true,
					label: "Peak",
					note: "full rate",
					boundary: active.end,
					until: active.end - t
				};
			}
			const next = spans.find((span) => span.start > t);
			return {
				peak: false,
				label: "Off-peak",
				note: "half rate",
				boundary: next === undefined ? null : next.start,
				until: next === undefined ? null : next.start - t
			};
		}

		/** "2h 14m", "43m 05s", "38s" — hour precision while far out, seconds at the end. */
		function formatDuration(ms) {
			const total = Math.max(0, Math.round(ms / 1000));
			const hours = Math.floor(total / 3600);
			const minutes = Math.floor((total % 3600) / 60);
			const seconds = total % 60;
			if (hours > 0) return hours + "h " + pad(minutes) + "m";
			if (minutes > 0) return minutes + "m " + pad(seconds) + "s";
			return seconds + "s";
		}

		// Locale-aware wall clock (09:00 or 9:00 AM, per the browser's locale).
		let clockFormat = null;
		function clock(date) {
			if (clockFormat === null) {
				try {
					clockFormat = new Intl.DateTimeFormat(undefined, {
						hour: "numeric",
						minute: "2-digit"
					});
				} catch (error) {
					clockFormat = { format: (value) => pad(value.getHours()) + ":" + pad(value.getMinutes()) };
				}
			}
			return clockFormat.format(date);
		}

		/**
		 * One daily cycle of peak windows rendered in the viewer's own time zone,
		 * ordered by local clock time. A window that crosses local midnight (which
		 * happens west of UTC) is marked so "23:00 – 03:00" is not misread.
		 */
		function localWindows(now) {
			const t = now.getTime();
			const seen = new Set();
			const rows = [];
			for (const span of occurrences(now)) {
				if (span.end <= t || span.start >= t + DAY_MS) continue;
				const start = new Date(span.start);
				const end = new Date(span.end);
				const text =
					clock(start) +
					" \u2013 " +
					clock(end) +
					(start.getDate() === end.getDate() ? "" : " (+1 day)");
				if (seen.has(text)) continue;
				seen.add(text);
				rows.push({ text, minutes: start.getHours() * 60 + start.getMinutes() });
			}
			rows.sort((a, b) => a.minutes - b.minutes);
			return rows.map((row) => row.text);
		}

		/** Countdown sentence: "Peak starts in 2h 14m" / "Peak ends in 43m 05s". */
		function countdownLabel(status) {
			return (status.peak ? "Peak ends in " : "Peak starts in ") + formatDuration(status.until);
		}

		/** Single-sentence version for the accessible name. */
		function summaryText(status) {
			const head = "DeepSeek API " + status.label.toLowerCase() + " (" + status.note + ")";
			if (status.until === null) return head + ".";
			return (
				head + ". " + countdownLabel(status) + ", at " + clock(new Date(status.boundary)) + " local time."
			);
		}

		function dot(color, size) {
			return React.createElement("span", {
				"aria-hidden": "true",
				style: {
					width: size,
					height: size,
					borderRadius: "50%",
					background: color,
					flexShrink: 0
				}
			});
		}

		/** Hover card: status, live countdown, and the local peak hours. */
		function hoverCard(date) {
			const status = statusAt(date);
			const color = status.peak ? PEAK_COLOR : OFF_PEAK_COLOR;
			const rows = [
				React.createElement(
					"div",
					{
						key: "status",
						style: { display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }
					},
					dot(color, 7),
					status.label + " \u2014 " + status.note
				)
			];
			if (status.until !== null) {
				rows.push(
					React.createElement(
						"div",
						{ key: "countdown" },
						countdownLabel(status),
						React.createElement(
							"span",
							{ style: { opacity: 0.65 } },
							" \u00b7 " + clock(new Date(status.boundary))
						)
					)
				);
			}
			const windows = localWindows(date);
			if (windows.length > 0) {
				// Label beside the list rather than above it: three rows total, and the
				// windows stay one per line instead of wrapping mid-list in 12-hour locales.
				rows.push(
					React.createElement(
						"div",
						{ key: "windows", style: { display: "flex", gap: 6, marginTop: 4 } },
						React.createElement(
							"span",
							{ style: { opacity: 0.65, flexShrink: 0 } },
							"Peak hours"
						),
						React.createElement(
							"div",
							{ style: { display: "flex", flexDirection: "column", gap: 2 } },
							windows.map((text, index) =>
								React.createElement("div", { key: "window-" + String(index) }, text)
							)
						)
					)
				);
			}
			return React.createElement(
				"div",
				{
					style: {
						display: "flex",
						flexDirection: "column",
						gap: 2,
						textAlign: "left",
						fontVariantNumeric: "tabular-nums"
					}
				},
				rows
			);
		}

		/** Same information as plain text, for the native-`title` fallback path. */
		function hoverText(date) {
			const status = statusAt(date);
			const lines = [status.label + " \u2014 " + status.note];
			if (status.until !== null) {
				lines.push(countdownLabel(status) + " \u00b7 " + clock(new Date(status.boundary)));
			}
			const windows = localWindows(date);
			if (windows.length > 0) lines.push("Peak hours: " + windows.join(", "));
			return lines.join("\n");
		}

		function Badge({ wide }) {
			const [now, setNow] = useState(() => new Date());
			// True while the pointer (or keyboard focus) is on the badge, i.e. while
			// the hover card is up: only then is a per-second countdown worth ticking.
			const [watched, setWatched] = useState(false);

			useEffect(() => {
				// Idle: 30s is enough to flip the dot. Hovered: 1s keeps the countdown live.
				const timer = setInterval(() => setNow(new Date()), watched ? 1000 : 30000);
				return () => clearInterval(timer);
			}, [watched]);

			const status = statusAt(now);
			const color = status.peak ? PEAK_COLOR : OFF_PEAK_COLOR;
			const open = () => {
				setNow(new Date());
				setWatched(true);
			};
			const close = () => setWatched(false);

			const indicator = React.createElement(
				"div",
				{
					// Focusable so the same detail is reachable without a pointer;
					// the shell Tooltip opens on focus as well as hover.
					tabIndex: 0,
					"aria-label": summaryText(status),
					...(Tooltip === null ? { title: hoverText(now) } : {}),
					onMouseEnter: open,
					onMouseLeave: close,
					onFocus: open,
					onBlur: close,
					style: {
						display: "flex",
						alignItems: "center",
						gap: 6,
						padding: "4px 8px",
						borderRadius: 6,
						cursor: "default"
					}
				},
				dot(color, 8),
				wide
					? React.createElement(
							"span",
							{
								style: {
									fontSize: 12,
									fontWeight: 600,
									lineHeight: 1,
									color
								}
							},
							status.label
					  )
					: null
			);

			if (Tooltip === null) return indicator;
			// `label` as a thunk is re-evaluated on open and on every re-render, so the
			// card is built from a fresh clock rather than from the badge's last tick.
			return React.createElement(
				Tooltip,
				{
					label: () => hoverCard(new Date()),
					side: "top",
					delayMs: 200,
					maxWidth: 300
				},
				indicator
			);
		}

		// Required client services. `slots` is the UI slot registry.
		const inject = ["slots"];

		function apply(ctx) {
			// Register the badge into the sidebar footer action list. This is an
			// additive ("list") slot, so it appears alongside Settings rather than
			// replacing anything.
			ctx.slots.inject("sidebar.footer.action", () =>
				ctx.slots.register(
					{
						name: "sidebar.footer.action",
						id: "peak-off-peak"
					},
					Badge
				)
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
