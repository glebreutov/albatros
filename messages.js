/**
 * @typedef {Object} DriverResponse
 * @property {boolean} ack
 * @property {Object|string} [error]
 * @property {Object} [response] - api response for debug purposes
 * @property {Exchange} exch
 */

/**
 * @typedef {Object} Pair
 * @property {string} base
 * @property {string} counter
 * @property {string} display
 */

/**
 * @typedef {DriverResponse} OrderStatus
 * @property {string} [id]
 * @property {number} [remains]
 * @property {Pair} [pair]
 */

/**
 * @typedef {DriverResponse} BalanceStatus
 * @property {number} balance
 */

/**
 * @typedef {string} Side
 */

/**
 * @typedef {string} AssetId
 */

/**
 * @typedef {string} CryptoWallet
 */

/**
 * @typedef {string} Exchange
 */
