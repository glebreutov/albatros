
const constantFail = {ack: false}

exports.openPosition = async (assetId, size, sides) => {
  return constantFail
}

exports.newOrder = async (pair, price, size, sides) => {
  return constantFail
}

exports.closePosition = async (pos) => {
  return constantFail
}

exports.cancel = async (order) => {
  return constantFail
}

exports.waitForExec = async (order) => {
  return constantFail
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
