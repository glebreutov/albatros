const {sides} = require('./const')
const {sleep} = require('./tools')
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

/**
 * @return OrderStatus
 */
async function newOrder (exch, pair, price, size, side) {
  return getDriver(exch).newOrder(pair, price, size, side)
}

exports.closePositions = async (exch) => {
  return getDriver(exch).closePositions()
}

exports.buy = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, sides.BID)
}

exports.sell = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, sides.ASK)
}

exports.long = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, sides.LONG)
}

exports.short = async(exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, sides.SHORT)
}

exports.cancel = async (order) => {
  return getDriver(order.exch).cancel(order)
}

const withdraw = async (exch, assetId, amount, wallet) => {
  return getDriver(exch).withdraw(assetId, amount, wallet)
}
exports.withdraw = withdraw

async function balance (exch, assetId) {
  return getDriver(exch).balance(assetId)
}
exports.balance = balance

exports.transferFunds = async (from, to, amount, assetId, toWallet) => {
  const targetBalance = await balance(to, assetId)
  if (!targetBalance.ack) {
    return targetBalance
  }
  const withdrawStatus = await withdraw(from, assetId, amount, toWallet)
  if (!withdrawStatus.ack) {
    return withdrawStatus
  }

  while (true) {
    const updatedBalance = await balance(to, assetId)
    if (updatedBalance.ack && targetBalance.balance < updatedBalance.balance) {
      return {ack: true}
    }
    await sleep(10000)
  }
}

exports.orderStatus = async (order) => {
  return getDriver(order.exch).orderStatus(order)
}
