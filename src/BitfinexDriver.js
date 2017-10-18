const BitfinexRest = require('./BitfinexRest')
const debug = require('debug')('BitfinexDriver')
const {assert, sleep} = require('./tools')
const {sides} = require('./const')

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

exports.depositAwait = async (assetId) => {
  let newBalance
  const initial = (await exports.balance(assetId)).balance
  do {
    await sleep(1000)
    newBalance = (await exports.balance(assetId)).balance
  } while (initial <= newBalance)
  return newBalance
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
