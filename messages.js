/**
 * @typedef {Object} DriverResponse
 * @property {boolean} ack
 * @property {Object|string} [error]
 * @property {Object} [response] - api response for debug purposes
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
