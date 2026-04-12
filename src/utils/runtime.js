/**
 * Runtime mode detection.
 *
 * Two modes: `interactive` (human at a terminal, pretty output) and `json`
 * (machine consumer, structured output). Selection rules, first match wins:
 *
 *   1. setForceJson(true)         → json mode
 *   2. setForceInteractive(true)  → interactive mode
 *   3. stdout.isTTY && stdin.isTTY → interactive mode
 *   4. otherwise                  → json mode
 *
 * Checked fresh on every getRuntime() call. Never cached, because a single
 * process may emit output in both modes (for example an interactive prompt
 * during `configure` followed by a flush-to-stdout of the JSON result).
 */

let _forceJson = false;
let _forceInteractive = false;

export function setForceJson(value) {
  _forceJson = Boolean(value);
}

export function setForceInteractive(value) {
  _forceInteractive = Boolean(value);
}

export function getRuntime() {
  if (_forceJson) {
    return { interactive: false, json: true };
  }
  if (_forceInteractive) {
    return { interactive: true, json: false };
  }
  const stdoutTTY = process.stdout.isTTY === true;
  const stdinTTY = process.stdin.isTTY === true;
  const interactive = stdoutTTY && stdinTTY;
  return { interactive, json: !interactive };
}
