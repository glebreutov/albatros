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
  if (!order.id && !order.error) {
    order.ack = false
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

// controller: {continue: bool}
exports.waitForExec = async (order, controller) => {
  do {
    await sleep(1000)
    try {
      order = await api.getOrderStatus(order.id)
    } catch (e) {
      console.log(e)
    }
  } while (order.is_live && controller.continue)
  return order
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
