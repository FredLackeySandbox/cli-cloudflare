/**
 * Unified output helper.
 *
 * `createOutput(runtime)` returns an object with the same API regardless of
 * mode. In interactive mode, each call prints immediately with chalk
 * formatting. In JSON mode, calls accumulate into a `_data` object and
 * `flush()` emits the full object as JSON to stdout.
 *
 * Every command should:
 *   const runtime = getRuntime();
 *   const out = createOutput(runtime);
 *   // ... out.heading() / out.info() / out.set() ...
 *   out.flush();   // must be the last thing the command does
 *
 * Output routing:
 *   - stdout: the result stream. In JSON mode, only the single flush() call
 *     writes to stdout — everything else either accumulates (info, success,
 *     set, etc.) or is a no-op (banner, dim, blank).
 *   - stderr: warnings, failures, and any other diagnostic-flavored output
 *     when running in interactive mode. In JSON mode, warnings and soft
 *     failures accumulate into the result payload; truly fatal errors go
 *     through fatalError() in utils/errors.js, which writes structured JSON
 *     to stderr.
 */

import chalk from 'chalk';

const DIVIDER = '\u2500';
const ANSI_RE = /\u001b\[[0-9;]*m/g;

function stripAnsi(value) {
  return typeof value === 'string' ? value.replace(ANSI_RE, '') : value;
}

export function createOutput(runtime) {
  const _data = {};
  let _section = null;

  function ensureSection() {
    if (!_section) _section = '_log';
    if (!_data[_section] || !Array.isArray(_data[_section])) {
      _data[_section] = [];
    }
  }

  function pushEntry(level, message, detail) {
    if (!runtime.json) return;
    ensureSection();
    const entry = { level, message: stripAnsi(message) };
    if (detail !== undefined) entry.detail = detail;
    _data[_section].push(entry);
  }

  return {
    /** Cosmetic banner. No-op in JSON mode. */
    banner(title) {
      if (!runtime.interactive) return;
      const line = DIVIDER.repeat(Math.max(4, title.length + 4));
      console.log('');
      console.log(chalk.cyan(line));
      console.log(chalk.cyan(`  ${chalk.bold(title)}`));
      console.log(chalk.cyan(line));
      console.log('');
    },

    /**
     * Start a new logical section. In JSON mode the section name becomes a
     * key under which subsequent info/success/warn/fail entries accumulate.
     */
    heading(text) {
      const key = text.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
      _section = key || '_log';
      if (runtime.json) {
        if (!_data[_section]) _data[_section] = [];
        return;
      }
      console.log('');
      console.log(chalk.bold.white(`  ${text}`));
      console.log(chalk.dim(`  ${DIVIDER.repeat(text.length)}`));
    },

    info(message, detail) {
      pushEntry('info', message, detail);
      if (!runtime.interactive) return;
      console.log(chalk.white(`  ${message}`));
    },

    success(message, detail) {
      pushEntry('ok', message, detail);
      if (!runtime.interactive) return;
      console.log(chalk.green(`  \u2713 ${message}`));
    },

    /** Diagnostic-flavored. Goes to stderr in interactive mode. */
    warn(message, detail) {
      pushEntry('warn', message, detail);
      if (!runtime.interactive) return;
      process.stderr.write(chalk.yellow(`  ! ${message}`) + '\n');
    },

    /** Non-fatal failure. For fatal errors, throw and let errors.js handle it. */
    fail(message, detail) {
      pushEntry('error', message, detail);
      if (!runtime.interactive) return;
      process.stderr.write(chalk.red(`  \u2716 ${message}`) + '\n');
    },

    /** Secondary/faded message. No-op in JSON mode. */
    dim(message) {
      if (!runtime.interactive) return;
      console.log(chalk.dim(`  ${message}`));
    },

    /** Spacer. No-op in JSON mode. */
    blank() {
      if (!runtime.interactive) return;
      console.log('');
    },

    /**
     * Set an arbitrary top-level key in the JSON payload. No-op in
     * interactive mode — pair with info()/success() calls that the human
     * will see.
     */
    set(key, value) {
      if (runtime.json) {
        _data[key] = value;
      }
    },

    /**
     * Emit the accumulated JSON payload to stdout. Must be called at the end
     * of every command. No-op in interactive mode.
     */
    flush() {
      if (!runtime.json) return;
      process.stdout.write(JSON.stringify(_data, null, 2) + '\n');
    },
  };
}
