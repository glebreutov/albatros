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
      return {ack: true}
    }
    await sleep(10000)
  }
}

exports.orderStatus = async (order) => {
  return getDriver(order.exch).orderStatus(order)
}
