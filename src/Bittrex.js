/* eslint-env node */
const EventEmitter = require('events')
const bittrex = require('node-bittrex-api')
const {bind, createConverter} = require('./tools')
const _ = require('lodash')
const {pairs} = require('./const')
const debug = require('debug')('BittrexApi')

const converter = createConverter({
  [pairs.USDTBTC]: 'USDT-BTC'
})

// https://github.com/dparlevliet/node.bittrex.api#websockets
class BittrexApi extends EventEmitter {
  constructor (...args) {
    super(...args)
    debug('Creating BittrexApi')
    bittrex.options({verbose: true})
    bind([
      'onSubscriptionMessage'
    ], this)
    this.subscriptions = []
  }

  getLastUpdated () {
    return this.subscriptions.map(s => ({pair: converter.normalize(s.pair), lastUpdated: s.lastUpdated}))
  }

  onSubscriptionMessage (data) {
    if (data.M === 'updateExchangeState') {
      data.A.forEach(dataFor => {
        const pair = dataFor.MarketName
        const subscription = _.find(this.subscriptions, {channel: 'book', pair})
        if (!subscription) {
          debug(`ERROR: received data for pair ${pair} but no according subscription found`)
          return
        }
        subscription.lastUpdated = +new Date()
        this.emit('bookUpdate', converter.denormalize(pair), {buy: dataFor.Buys, sell: dataFor.Sells})
      })
    }
  }

  // todo: reconnects?
  async subscribe (pairs) {
    for (let i = 0; i < pairs.length; i++) {
      const pair = converter.denormalize(pairs[i])
      const newSub = {
        channel: 'book',
        pair
      }
      if (_.some(this.subscriptions, newSub)) {
        debug(`already subscribed to ${pair}`)
        continue
      }
      this.subscriptions.push(newSub)
    }
    bittrex.websockets.subscribe(pairs.map(converter.denormalize), this.onSubscriptionMessage)
  }
}

module.exports = BittrexApi
