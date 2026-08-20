// Node half of the dsh-peak-off-peak plugin.
//
// This is the module the host (Node) Loader runs. The badge itself is browser
// presentation only, so this half contributes nothing at runtime: the empty
// `apply` simply gives the Loader a live host row, which is what lets the
// client-modules host discover this package's `dsh.client` declaration and
// serve `client.js` to the browser.
//
// A plugin in DeepSeek Harness is a Cordis plugin: a module exporting `apply`
// (and optionally `name`, `inject`, `Config`). The framework calls `apply(ctx)`
// once when the plugin loads.
export const name = "peak-off-peak";

export function apply() {}
