'use strict';
const log = {
  info:  (...a) => console.log('[INFO]',  ...a),
  warn:  (...a) => console.warn('[WARN]',  ...a),
  error: (...a) => console.error('[ERROR]', ...a),
  debug: (...a) => { if (process.env.DEBUG) console.log('[DEBUG]', ...a); },
};
module.exports = log;
