// Browser half of the dsh-peak-off-peak plugin.
//
// This file is served to the browser as /plugins/dsh-peak-off-peak/client.js
// and executes through the client module loader. It registers a React
// component into the `sidebar.footer.action` slot, so the peak/off-peak badge
// appears at the sidebar foot next to Settings.
//
// It only `require`s "react" (a platform-provided static module), so it has no
// other plugin dependencies.
window.__ModuleLoader__.load({
	id: "dsh-peak-off-peak",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		const React = require("react");
		const { useState, useEffect } = React;

		// Peak windows in UTC, from https://api-docs.deepseek.com/quick_start/pricing/ :
		//   "Peak hours are 01:00 - 04:00 and 06:00 - 10:00 UTC
		//    (all other hours are off-peak). Off-peak rates are half of the peak rates."
		// Each entry is [startHour, endHour), so e.g. [1, 4] covers 01:00 <= t < 04:00.
		const PEAK_WINDOWS = [
			[1, 4],
			[6, 10]
		];

		function rateAt(date) {
			const h =
				date.getUTCHours() +
				date.getUTCMinutes() / 60 +
				date.getUTCSeconds() / 3600;
			for (const [start, end] of PEAK_WINDOWS) {
				if (h >= start && h < end) {
					return { peak: true, label: "Peak", note: "full rate" };
				}
			}
			return { peak: false, label: "Off-peak", note: "half rate" };
		}

		function Badge({ wide }) {
			const [now, setNow] = useState(() => new Date());

			useEffect(() => {
				// Re-evaluate every 30s so the badge flips without a reload.
				const timer = setInterval(() => setNow(new Date()), 30000);
				return () => clearInterval(timer);
			}, []);

			const status = rateAt(now);
			const color = status.peak ? "#e5484d" : "#2f9e44";
			const title = `DeepSeek API ${status.label} (${status.note})\n` +
				"Peak hours: 01:00\u201304:00 & 06:00\u201310:00 UTC";

			return React.createElement(
				"div",
				{
					title,
					"aria-label": `DeepSeek API rate: ${status.label}`,
					style: {
						display: "flex",
						alignItems: "center",
						gap: 6,
						padding: "4px 8px",
						cursor: "default"
					}
				},
				React.createElement("span", {
					style: {
						width: 8,
						height: 8,
						borderRadius: "50%",
						background: color,
						flexShrink: 0
					}
				}),
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

//# sourceMappingURL=client.js.map
