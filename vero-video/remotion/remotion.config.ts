/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { existsSync } from "node:fs";
import { Config } from "@remotion/cli/config";

Config.setRspack(true);
Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setDefaultPremountInSeconds(2);

// Remotion normally downloads its own Chrome Headless Shell from remotion.media.
// Where that host is unreachable (e.g. a sandboxed cloud session), use a local
// headless shell instead: set REMOTION_BROWSER_EXECUTABLE, or the Playwright one
// below is picked up automatically if present. On a regular machine, neither applies.
const localShell =
  process.env.REMOTION_BROWSER_EXECUTABLE ??
  "/opt/pw-browsers/chromium_headless_shell";
if (existsSync(localShell)) {
  Config.setBrowserExecutable(localShell);
}
