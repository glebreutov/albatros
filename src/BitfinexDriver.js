const BitfinexRest = require('./BitfinexRest')
const debug = require('debug')('BitfinexDriver')
const {assert} = require('./tools')
const {exchanges} = require('./const')

let apiInstance
function api () {
  assert(apiInstance, 'call setKeys() first')
  return apiInstance
}
exports.setKeys = (apiKey, apiSecret, nonceGenerator) => {
  apiInstance = new BitfinexRest(apiKey, apiSecret, nonceGenerator)
}

/**
 * Place new Order
 * @param {Pair} pair
 * @param {number} price
 * @param {number} size
 * @param {Side} side
 * @return {Promise.<OrderStatus>}
 */
exports.newOrder = async (pair, price, size, side) => {
  /** @type OrderStatus */
  const order = {ack: false, error: new Error('Unknown error'), exch: exchanges.BITFINEX}
  try {
    order.response = await api().newOrder(pair, price, size, side)
    // todo: move this condition to BitfinexRest
    if (order.response.id) {
      return {
        ...order,
        pair,
        ack: true,
        error: null,
        id: order.response.id.toString(),
        remains: order.response.remaining_amount && parseFloat(order.response.remaining_amount)
      }
    } else {
      return {
        ...order,
        pair,
        ack: false,
        error: 'No order id, see response'
      }
    }
  } catch (e) {
    order.error = e
  }
  return order
}

/**
 * Cancel order
 * @param {OrderStatus} order
 * @return {Promise.<DriverResponse>}
 */
exports.cancel = async (order) => {
  try {
    return {
      ...order,
      response: await api().cancelOrder(parseInt(order.id)),
      ack: true
    }
  } catch (e) {
    return {
      exch: exchanges.BITFINEX,
      ack: false,
      error: e
    }
  }
}

/**
 * Withdraw funds to the specified wallet
 * @param {AssetId} assetId
 * @param {number} amount
 * @param {CryptoWallet} wallet
 * @return {Promise.<DriverResponse>}
 */
exports.withdraw = async (assetId, amount, wallet) => {
  try {
    const status = await api().withdraw(assetId, amount, wallet)
    // todo: move this condition to BitfinexRest
    if (status.status === 'success') {
      return {
        ack: true,
        exch: exchanges.BITFINEX,
        response: status
      }
    }
    return {
      ack: false,
      exch: exchanges.BITFINEX,
      response: status,
      error: new Error('Unknown error')
    }
  } catch (e) {
    return {
      ack: false,
      exch: exchanges.BITFINEX,
      error: e
    }
  }
}

/**
 * Get account balance in specified currency
 * @param {AssetId} assetId
 * @return {Promise.<BalanceStatus>}
 */
exports.balance = async (assetId) => {
  try {
    return {
      balance: (await api().getWallets())
        .filter(w => w.currency === assetId)
        .reduce((acc, next) => acc + parseFloat(next.amount), 0),
      ack: true,
      exch: exchanges.BITFINEX
    }
  } catch (e) {
    return {
      ack: false,
      exch: exchanges.BITFINEX,
      error: e
    }
  }
}

/**
 * Get order status
 * @param {OrderStatus} order
 * @return {Promise.<OrderStatus>}
 */
exports.orderStatus = async (order) => {
  try {
    const orderStatus = await api().getOrderStatus(parseInt(order.id))
    if (!orderStatus.remaining_amount && orderStatus.remaining_amount !== 0) {
      throw new Error(`Unexpected remaining_amount in response: ${orderStatus.remaining_amount}, full response ${JSON.stringify(orderStatus)}`)
    }
    return {
      ...order,
      response: orderStatus,
      remains: parseFloat(orderStatus.remaining_amount),
      ack: true
    }
  } catch (e) {
    return {
      ack: false,
      exch: exchanges.BITFINEX,
      error: e
    }
  }
}

/**
 * Try to close all active positions
 * @return {Promise.<void>}
 */
exports.closePositions = async () => {
  let responses
  try {
    const positions = await api().positions()
    responses = positions
    for (let i = 0; i < positions.length; i++) {
      let position = positions[i]
      responses.push(await api().claimPosition(position.id, Math.abs(parseFloat(position.amount))))
    }
    return {
      ack: true,
      exch: exchanges.BITFINEX,
      response: responses
    }
  } catch (e) {
    return {
      ack: false,
      exch: exchanges.BITFINEX,
      response: responses,
      error: e
    }
  }
}

/**
 * Get a wallet to send asset to
 * @param {AssetId} assetId
 * @return {Promise.<DepositWallet>}
 */
exports.wallet = async (assetId) => {
  try {
    const response = await api().deposit(assetId, 'trading')
    return {
      ack: true,
      exch: exchanges.BITFINEX,
      wallet: response.address,
      response
    }
  } catch (e) {
    return {
      ack: false,
      exch: exchanges.BITFINEX,
      error: e
    }
  }
}
