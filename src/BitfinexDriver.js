const BitfinexApi = require('./Bitfinex')
const debug = require('debug')('BitfinexDriver')
const {sleep} = require('./tools')

const constantFail = {ack: false}

const api = new BitfinexApi()

exports.openPosition = async (assetId, size, side) => {
  return constantFail
}

exports.newOrder = async (pair, price, size, side) => {
  let order
  try {
    order = await api.newOrder(pair, price, size, side)
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
    order.error = 'unknown'
  }
  return order
}

exports.closePosition = async (pos) => {
  return constantFail
}

exports.cancel = async (order) => {
  return api.cancelOrder(order)
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
      console.log('requesting order status')
      const newOrderStatus = await api.getOrderStatus(order.id)
      if (!newOrderStatus.is_live) {
        return newOrderStatus
      }
    }
    console.log('loop breaked')
  }

  const c = {continue: true}
  const result = await Promise.race([
    request(c),
    controller
  ])
  // break the loop
  console.log('breaking the loop')
  c.continue = false
  return result
}

exports.withdraw = async (assetId, wallet) => {
  return constantFail
}

exports.balance = async (assetId) => {
  return constantFail
}

exports.depositAwait = async (assetId) => {
  return constantFail
}

exports.transferFunds = async (from, to, assetId, toWallet) => {
  return constantFail
}
