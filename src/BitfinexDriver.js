const BitfinexRest = require('./BitfinexRest')
const debug = require('debug')('BitfinexDriver')
const {assert} = require('./tools')

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
  const order = {ack: false, error: new Error('Unknown error')}
  try {
    order.response = await api().newOrder(pair, price, size, side)
    // todo: move this condition to BitfinexRest
    if (order.response.id) {
      return {
        ...order,
        ack: true,
        error: null,
        id: order.response.id.toString(),
        remains: order.response.remaining_amount && parseFloat(order.response.remaining_amount)
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
      response: await api().cancelOrder(order.id),
      ack: true
    }
  } catch (e) {
    return {
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
        response: status
      }
    }
    return {
      ack: false,
      response: status,
      error: new Error('Unknown error')
    }
  } catch (e) {
    return {
      ack: false,
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
      ack: true
    }
  } catch (e) {
    return {
      ack: false,
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
    const orderStatus = await api().getOrderStatus(order.id)
    return {
      ...order,
      response: orderStatus,
      remains: orderStatus.remaining_amount && parseFloat(orderStatus.remaining_amount),
      ack: true
    }
  } catch (e) {
    return {
      ack: false,
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
      response: responses
    }
  } catch (e) {
    return {
      ack: false,
      response: responses,
      error: e
    }
  }
}
