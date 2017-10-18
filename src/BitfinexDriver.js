const BitfinexRest = require('./BitfinexRest')
const debug = require('debug')('BitfinexDriver')
const {assert, sleep} = require('./tools')

const fail = msg => ({ack: false, error: new Error(msg)})

let apiInstance
function api () {
  assert(apiInstance, 'call setKeys() first')
  return apiInstance
}
exports.setKeys = (apiKey, apiSecret, nonceGenerator) => {
  apiInstance = new BitfinexRest(apiKey, apiSecret, nonceGenerator)
}

exports.openPosition = async (assetId, size, side) => {
  return fail('function not supported')
}

exports.closePositions = async () => {
  return fail('function not supported')
}

exports.loan = async (assetId, size) => {
  let order
  try {
    order = await api().loan(assetId, size)
  } catch (e) {
    debug('ERROR: could not loan: ', e)
    order = {
      ack: false,
      error: e
    }
  }

  if (order.id) {
    order.ack = true
    return order
  }
  order.ack = false
  if (!order.error) {
    order.error = 'unknown'
  }
  return order
}

exports.newOrder = async (pair, price, size, side) => {
  let order
  try {
    order = await api().newOrder(pair, price, size, side)
  } catch (e) {
    debug('ERROR: could not place order: ', e)
    order = {
      ack: false,
      error: e
    }
  }

  if (order.id) {
    order.ack = true
    return order
  }
  order.ack = false
  if (!order.error) {
    order.error = new Error('Unknown error')
  }
  return order
}

exports.cancel = async (order) => {
  try {
    return {
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

// controller: Promise
exports.waitForExec = async (order, controller) => {
  if (!order.id) {
    throw new Error('order.id is not valid')
  }

  async function request (loopBreaker) {
    while (true) {
      if (!loopBreaker.continue) { break }
      await sleep(500)
      if (!loopBreaker.continue) { break }
      debug('requesting order status')
      const newOrderStatus = await api().getOrderStatus(order.id)
      if (!newOrderStatus.is_live) {
        return newOrderStatus
      }
    }
    debug('loop breaked')
  }

  const c = {continue: true}
  const result = await Promise.race([
    request(c),
    controller
  ])
  // break the loop
  debug('breaking the loop')
  c.continue = false
  return result
}

exports.withdraw = async (assetId, amount, wallet) => {
  try {
    const status = await api().withdraw(assetId, amount, wallet)
    if (status.status === 'success') {
      return {
        ack: true,
        id: status.withdrawal_id
      }
    }
    return {
      ack: false,
      error: new Error(`unknown error: \n${JSON.stringify(status, null, 2)}`)
    }
  } catch (e) {
    return {
      ack: false,
      error: e
    }
  }
}

exports.balance = async (assetId) => {
  try {
    return {
      balance: await api().balance(assetId),
      ack: true
    }
  } catch (e) {
    return {
      ack: false,
      error: e
    }
  }
}

exports.depositAwait = async (assetId) => {
  return fail('not implemented')
}

exports.orderStatus = async (order) => {
  try {
    const orderStatus = await api().getOrderStatus(order.id)
    return {
      ...orderStatus,
      remains: parseFloat(orderStatus.remaining_amount),
      ack: true
    }
  } catch (e) {
    return {
      ack: false,
      error: e
    }
  }
}
