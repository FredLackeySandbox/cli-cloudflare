/**
 * Minimal interactive prompt helpers.
 *
 * All of these gracefully return the provided default when stdin is not a
 * TTY, so an agent invoking the CLI non-interactively will never hang on a
 * prompt. Prompts themselves are written to stderr so they do not pollute
 * the stdout result stream.
 */

import readline from 'node:readline';

let _rl = null;

function getRl() {
  if (_rl) return _rl;
  _rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
    terminal: true,
  });
  return _rl;
}

export function closeRl() {
  if (_rl) {
    _rl.close();
    _rl = null;
  }
}

/**
 * Ask a free-form question. Returns the user's answer, or the default if
 * stdin is not a TTY, or the default if the user just hits enter.
 */
export function ask(question, defaultValue = '') {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(defaultValue);
      return;
    }
    const suffix = defaultValue ? ` [${defaultValue}]` : '';
    getRl().question(`${question}${suffix}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

/**
 * Ask a yes/no question. Returns boolean.
 */
export function confirm(question, defaultValue = false) {
  return new Promise((resolve) => {
    if (!process.stdin.isTTY) {
      resolve(defaultValue);
      return;
    }
    const suffix = defaultValue ? ' [Y/n]' : ' [y/N]';
    getRl().question(`${question}${suffix}: `, (answer) => {
      const trimmed = answer.trim().toLowerCase();
      if (!trimmed) {
        resolve(defaultValue);
        return;
      }
      resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}
