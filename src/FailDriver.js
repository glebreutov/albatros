const {position, sides} = require('./const')

const constantFail = {ack: false}

async function openPosition (exch, assetId, size, sides) {
  return constantFail
}

async function newOrder (exch, pair, price, size, sides) {
  return constantFail
}

exports.openShortPosition = async (exch, assetId, size) => {
  return openPosition(exch, assetId, size, position.SHORT)
}

exports.openLongPosition = async (exch, assetId, size) => {
  return openPosition(exch, assetId, size, position.LONG)
}

exports.closePosition = async (pos) => {
  return constantFail
}

exports.buy = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, sides.BID)
}

exports.sell = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, sides.ASK)
}

exports.cancel = async (order) => {
  return constantFail
}

exports.waitForExec = async (order) => {
  return constantFail
}

const withdraw = async (exch, assetId, wallet) => {
  return constantFail
}
exports.withdraw = withdraw

async function balance (exch, assetId) {
  return constantFail
}

const depositAwait = async (exch, assetId) => {
  return constantFail
}
exports.depositAwait = depositAwait

exports.transferFunds = async (from, to, assetId, toWallet) => {
  return constantFail
}