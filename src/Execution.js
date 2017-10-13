const {position, sides} = require('./const')

const drivers = {}

exports.registerDriver = (code, driver) => {
  drivers[code] = driver
}

function getDriver (code) {
  if (code in drivers) {
    return drivers[code]
  } else {
    return require('./FailDriver')
  }
}

async function openPosition (exch, assetId, size, sides) {
  return getDriver(exch).openPosition(assetId, size, sides)
}

async function newOrder (exch, pair, price, size, side) {
  return getDriver(exch).newOrder(pair, price, size, side)
}

exports.openShortPosition = async (exch, assetId, size) => {
  return openPosition(exch, assetId, size, position.SHORT)
}

exports.openLongPosition = async (exch, assetId, size) => {
  return openPosition(exch, assetId, size, position.LONG)
}

exports.closePosition = async (pos) => {
  return getDriver(pos.exch).closePosition(pos)
}

exports.buy = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, sides.BID)
}

exports.sell = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, sides.ASK)
}

exports.cancel = async (order) => {
  return getDriver(order.exch).cancel(order)
}

exports.waitForExec = async (order) => {
  return getDriver(order.exch).waitForExec(order)
}

const withdraw = async (exch, assetId, wallet) => {
  return getDriver(exch).withdraw(assetId, wallet)
}
exports.withdraw = withdraw

async function balance (exch, assetId) {
  return getDriver(exch).balance(assetId)
}
exports.balance = balance

const depositAwait = async (exch, assetId) => {
  const was = await balance(exch, assetId)
  while (was === await balance(exch, assetId)) {
    await new Promise((resolve) => setTimeout(resolve, 5000, 'one'))
  }
  return true
}
exports.depositAwait = depositAwait

exports.transferFunds = async (from, to, amount, assetId, toWallet) => {
  const withdrawStatus = await withdraw(from, assetId, toWallet)
  if (!withdrawStatus.ack) {
    console.error(`can't withdraw funds ${withdrawStatus}`)
    return {ack: false}
  }
  await depositAwait(to, assetId)
  return {ack: true}
}

exports.orderStatus = async (order) => {
  return getDriver(order.exch).orderStatus(order)
}
