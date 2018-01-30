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
  resetBalance(exch)
  return getDriver(exch).newOrder(pair, price, size, side)
}

exports.closePositions = async (exch) => {
  resetBalance(exch)
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
  resetBalance(order.exch)
  return getDriver(order.exch).cancel(order)
}

const withdraw = async (exch, assetId, amount, wallet) => {
  resetBalance(exch)
  return getDriver(exch).withdraw(assetId, amount, wallet)
}
exports.withdraw = withdraw

const wallet = async (exch, assetId) => {
  return getDriver(exch).wallet(assetId)
}
exports.wallet = wallet

async function balance (exch, assetId) {
  return getDriver(exch).balance(assetId)
}
exports.balance = balance

exports.transferFunds = async (from, to, amount, assetId) => {
  const targetBalance = await balance(to, assetId)
  if (!targetBalance.ack) {
    return targetBalance
  }
  const walletMessage = await wallet(to, assetId)
  if (!walletMessage.ack) {
    return walletMessage
  }
  const toWallet = walletMessage.wallet
  // const correctBitfAddr = to === 'BITF' && assetId === 'ETH' && toWallet === '0x3c8279d082e9d61bfc255d32153510796b063dad'
  // const correctBtrxAddr = to === 'BTRX' && assetId === 'BTC' && toWallet === '18FjdmsHGBVDVpELEsXTRqtXD7K6rj4owt'
  // if (!correctBitfAddr && !correctBtrxAddr) {
  //   return {ack: false, result: {to, assetId, toWallet}, message: `Not correct addess. Inner check`}
  // }
  const withdrawStatus = await withdraw(from, assetId, amount, toWallet)
  if (!withdrawStatus.ack) {
    return withdrawStatus
  }

  while (true) {
    const updatedBalance = await balance(to, assetId)
    if (updatedBalance.ack && targetBalance.balance < updatedBalance.balance) {
      resetBalance(to)
      return {ack: true}
    }
    await sleep(10000)
  }
}
const balances = {}

function resetBalance (exch) {
  if (balances[exch]) {
    balances[exch].expired = true
  }
}
exports.lazyBalance = async (exch, assetId) => {
  if (!balances[exch] || balances[exch].expired) {
    balances[exch] = {expired: false}
  }
  if (!balances[exch][assetId] || !balances[exch][assetId].ack) {
    balances[exch][assetId] = await balance(exch, assetId)
  }
  return balances[exch][assetId]
}
exports.orderStatus = async (order) => {
  return getDriver(order.exch).orderStatus(order)
}
