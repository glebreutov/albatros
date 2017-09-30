const Position = {
  SHORT: 'SHORT', LONG: 'LONG'
}

const Side = {
  BID: 'BID', ASK: 'ASK'
}

async function openPosition(exch, assetId, size, side){
  return null
}

async function newOrder(exch, pair, price, size, side){
  return null
}

exports.openShortPosition = async (exch, assetId, size) => {
  return openPosition(exch, assetId, size, Position.SHORT)
}

exports.openLongPosition = async (exch, assetId, size) => {
  return openPosition(exch, assetId, size, Position.LONG)
}

exports.closePosition = async (pos) => {
  return null
}

exports.buy = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, Side.BID)
}

exports.sell = async (exch, pair, price, size) => {
  return newOrder(exch, pair, price, size, Side.ASK)
}

exports.cancel = async (order) => {
  return null
}

exports.waitForExec = async (order) => {
  return null
}

const withdraw = async (exch, assetId, wallet) => {
  return null
}
exports.withdraw =  withdraw

const depositAwait = async (exch, assetId) => {
  return null
}
exports.depositAwait = depositAwait

exports.transferFunds = async (from, to, assetId, toWallet) =>{
  const withdrawStatus = await withdraw(from, assetId, toWallet)
  if (!withdrawStatus.ack) {
    console.error(`can't withdraw funds ${withdrawStatus}`)
    return {ack: false}
  }
  await depositAwait(to, assetId)
  return {ack: true}
}