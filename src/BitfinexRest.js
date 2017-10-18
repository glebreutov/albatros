const crypto = require('crypto')
const fetch = require('node-fetch')
const {assert, createConverter} = require('./tools')
const _ = require('lodash')
const {pairs, sides} = require('./const')

const pairConverter = createConverter([{
  normal: pairs.USDTBTC,
  specific: 'BTCUSD'
}])

const assetConverter = createConverter([{
  normal: pairs.USDTBTC.base,
  specific: 'usd'
}, {
  normal: pairs.USDTBTC.counter,
  specific: 'btc'
}])

const sideConverter = createConverter([{
  normal: sides.BID,
  specific: 'buy'
}, {
  normal: sides.ASK,
  specific: 'sell'
}, {
  normal: sides.LONG,
  specific: 'buy'
}, {
  normal: sides.SHORT,
  specific: 'sell'
}])

function getOrderType (side) {
  return [sides.SHORT, sides.LONG].includes(side) ? 'limit' : 'exchange limit'
}

const withdrawConverter = createConverter([{
  normal: pairs.USDTBTC.counter,
  specific: 'bitcoin'
}, {
  normal: pairs.USDTBTC.base,
  specific: 'tether'
}])

class BitfinexRest {
  constructor (apiKey, apiSecret, nonceGenerator) {
    assert(apiKey, 'Missing api key')
    assert(apiSecret, 'Missing secret key')
    assert(nonceGenerator && _.isFunction(nonceGenerator.lock) && _.isFunction(nonceGenerator.release), 'Missing nonceGenerator')
    this.url = 'https://api.bitfinex.com'
    this.version = 'v1'
    this.apiKey = apiKey
    this.apiSecret = apiSecret
    this.nonceGenerator = nonceGenerator
  }

  async getWallets () {
    return (await this.authRequest('balances')).map(w => ({...w, currency: assetConverter.normalize(w.currency)}))
  }

  async withdraw (assetId, amount, address, fromWallet = 'exchange') {
    const params = {
      withdraw_type: withdrawConverter.denormalize(assetId),
      walletselected: fromWallet,
      amount: amount.toString(),
      address
    }
    return this.authRequest('withdraw', params)
  }

  // // BROKEN AT API SIDE: BTC cannot be used for Margin Trading. Transfer to Margin wallet not possible.
  // async transfer (amount, currency, from, to) {
  //   const params = {
  //     amount: amount.toString(),
  //     currency: assetConverter.denormalize(currency),
  //     walletfrom: from,
  //     walletto: to
  //   }
  //   return this.authRequest('transfer', params)
  // }

  async deposit (assetId, toWallet = 'exchange') {
    const params = {
      method: withdrawConverter.denormalize(assetId),
      wallet_name: toWallet
    }
    return this.authRequest('deposit/new', params)
  }

  async getOrderStatus (id) {
    return this.authRequest('order/status', {order_id: id})
  }

  async getActiveOrders () {
    return this.authRequest('orders')
  }

  async cancelOrder (id) {
    return this.authRequest('order/cancel', {order_id: id})
  }

  async getOrderBook (pair) {
    const uri = 'book/' + pairConverter.denormalize(pair)
    // todo options like items limit
    return this.publicRequest(uri)
  }

  async positions () {
    return this.authRequest('positions')
  }

  async claimPosition (id, amount) {
    const params = {
      position_id: parseInt(id),
      amount: amount.toString()
    }
    return this.authRequest('position/claim', params)
  }

  async loan (assetId, size) {
    const params = {
      currency: assetConverter.denormalize(assetId),
      amount: size.toString(),
      rate: '0',
      period: 1,
      direction: 'loan'
    }
    return this.authRequest('offer/new', params)
  }

  async credits () {
    return this.authRequest('credits')
  }

  async history () {
    return this.authRequest('orders/hist')
  }

  async newOrder (pair, price, size, side, type) {
    const params = {
      symbol: pairConverter.denormalize(pair),
      amount: size.toString(),
      price: price.toString(),
      exchange: 'bitfinex',
      side: sideConverter.denormalize(side),
      type: type || getOrderType(side) || 'exchange limit',
      post_only: false,
      is_hidden: false
    }
    return this.authRequest('order/new', params)
  }

  async publicRequest (path) {
    const url = `${this.url}/${this.version}/${path}`
    return (await fetch(url, {
      method: 'GET',
      timeout: 15 * 1000
    })).json()
  }

  async authRequest (path, params = {}) {
    const url = `${this.url}/${this.version}/${path}`
    const nonce = JSON.stringify(await this.nonceGenerator.lock())
    const payload = Buffer.from(JSON.stringify({
      ...params,
      request: `/${this.version}/${path}`,
      nonce
    })).toString('base64')
    const signature = crypto.createHmac('sha384', this.apiSecret).update(payload).digest('hex')
    const headers = {
      'X-BFX-APIKEY': this.apiKey,
      'X-BFX-PAYLOAD': payload,
      'X-BFX-SIGNATURE': signature
    }

    try {
      return (await fetch(url, {
        method: 'POST',
        timeout: 15 * 1000,
        headers
      })).json()
    } finally {
      this.nonceGenerator.release()
    }
  }
}

module.exports = BitfinexRest
