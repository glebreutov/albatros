const crypto = require('crypto')
const {position, sides} = require('./const')
const fetch = require('node-fetch')
const sleep = require('./tools').sleep

let apiKey = '6fcaa371b3964427b214852323518634'
let apiSecret = '54138e62efca4c1790ab9c0bff2c196a'

exports.setKeys = (key, secret) => {
  apiKey = key
  apiSecret = secret
}

function failed (error) {
  return {ack: false, error}
}

function ok (status) {
  return {...status, ack: true}
}

function status (ack, payload) {
  return {ack, payload}
}

async function openPosition (assetId, size, sides) {
  return failed('function not supported')
}

async function newOrder (pair, price, size, side) {
  try {
    if (![sides.BID, sides.ASK].includes(side)) {
      return failed('no margin trading on bittrex')
    }
    const urlSuffix = (side === sides.ASK) ? 'market/selllimit' : 'market/buylimit'
    const strPair = pair.base + '-' + pair.counter
    const json = await req(urlSuffix, {market: strPair, quantity: size, rate: price})
    if (json.success) {
      return ok({pair, id: json.result.uuid, exch: 'BTRX'})
    } else {
      return failed(json)
    }
  } catch (e) {
    return failed(e)
  }
}
exports.newOrder = newOrder
exports.openShortPosition = async (assetId, size) => {
  return openPosition(assetId, size, position.SHORT)
}

exports.openLongPosition = async (assetId, size) => {
  return openPosition(assetId, size, position.LONG)
}

exports.closePositions = async (pos) => {
  return failed('not supported')
}

exports.buy = async (pair, price, size) => {
  return newOrder(pair, price, size, sides.BID)
}

exports.sell = async (pair, price, size) => {
  return newOrder(pair, price, size, sides.ASK)
}

exports.cancel = async (order) => {
  try {
    const cancelStatus = await req('market/cancel', {uuid: order.id})
    if (cancelStatus.success) {
      return ok({})
    } else {
      return failed(cancelStatus)
    }
  } catch (e) {
    return failed(e)
  }
}

exports.orderStatus = async (order) => {
  const resp = await messageStatus(order.id)
  if (!resp.ack) {
    return resp
  } else {
    return ok({remains: resp.payload.result.QuantityRemaining, resp})
  }
}
async function messageStatus (uuid) {
  try {
    const statusMsg = await req('account/getorder', {uuid})
    return status(statusMsg.success, statusMsg)
  } catch (e) {
    return failed(e)
  }
}

exports.waitForExec = async (order) => {
  while (true) {
    const status = await messageStatus(order.id)
    if (!status.ack) {
      return status
    } else if (status.payload.result.Closed) {
      return ok({details: 'order completed'})
    }
    await sleep(1000)
  }
}

const withdraw = async (assetId, amount, wallet) => {
  try {
    const statusMsg = await req('account/withdraw', {currency: assetId, quantity: amount, address: wallet})
    return status(statusMsg.success, statusMsg)
  } catch (e) {
    return failed(e)
  }
}
exports.withdraw = withdraw

exports.balance = async (assetId) => {
  try {
    const resp = await req('account/getbalances', {})
    if (!resp.success) {
      return failed(resp)
    }
    const curr = resp.result.filter(x => x.Currency === assetId).map(x => x.Balance)
    if (curr.length !== 1) {
      return failed('cant find currency with id ' + assetId)
    } else {
      const balance = curr[0]
      return ok({balance})
    }
  } catch (e) {
    return failed(e)
  }
}

exports.wallet = async (currency) => {
  try {
    const resp = await req('account/getdepositaddress', {currency})
    if (!resp.success) {
      return failed(resp)
    } else {
      return ok({wallet: resp.result.Address, exch: 'BTRX'})
    }
  } catch (e) {
    return failed(e)
  }
}

async function req (cmd, options) {
  function signedRequestHeades (apiSecret, uri) {
    const signature = crypto
      .createHmac('sha512', apiSecret)
      .update(uri)
      .digest('hex')

    return {
      'content-type': 'application/json',
      'apisign': signature
    }
  }

  function constructURL (cmd, apiKey, nonce, options) {
    const params = Object.keys(options).map(k => `${k}=${options[k]}`).join('&')
    return `https://bittrex.com/api/v1.1/${cmd}?apikey=${apiKey}&nonce=${nonce}&${params}`
  }

  const now = Date.now()
  const url = constructURL(cmd, apiKey, now, options)
  const headers = signedRequestHeades(apiSecret, url, now)
  const t = await fetch(url, {
    method: 'POST',
    headers
  })
  return t.json()
}
