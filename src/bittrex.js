/* eslint-env node */
const EventEmitter = require('events')
const {bind, createConverter} = require('./tools')
const fetch = require('node-fetch')
const _ = require('lodash')
const {pairs} = require('./const')
const debug = require('debug')('BittrexApi')


const converter = createConverter({
  [pairs.USDTBTC]: 'USDT-BTC'
})

class BittrexApi extends EventEmitter {
  constructor (...args) {
    super(...args)
    debug('Creating BittrexApi')
    bind([
      'beginPolling'
    ], this)
    this.subscriptions = []
    this.poller = 0
    this.destroying = false
  }

  async beginPolling () {
    const subscriptionToPoll = this.subscriptions.shift()
    this.subscriptions.push(subscriptionToPoll)
    try {
      const resp = await fetch(`https://bittrex.com/api/v1.1/public/getorderbook?market=${subscriptionToPoll.pair}&type=both`)
      subscriptionToPoll.lastUpdated = +new Date()
      const msg = await resp.json()
      if (this.destroying) {
        return
      }
      if (msg.success) {
        msg.result.buy.forEach(({Quantity, Rate}) =>
          this.emit('bookUpdate', converter.toUniformPair(subscriptionToPoll.pair), [Rate, 'buy', Quantity]))
        msg.result.sell.forEach(({Quantity, Rate}) =>
          this.emit('bookUpdate', converter.toUniformPair(subscriptionToPoll.pair), [Rate, 'sell', Quantity]))
      } else {
        debug(`ERROR: ${JSON.stringify(msg)}`)
      }
    } catch (e) {
      debug(`Polling ${JSON.stringify(subscriptionToPoll)}failed: ${e}`)
    } finally {
      if (!this.destroying) {
        this.poller = setTimeout(this.beginPolling, 1000)
      }
    }
  }

  destroy () {
    this.destroying = true
    clearInterval(this.poller)
  }

  async subscribeBook (pair) {
    const newSub = {
      type: 'getorderbook',
      pair: converter.fromUniformPair(pair)
    }
    // exists by type / pair
    if (_.some(this.subscriptions, newSub)) {
      debug(`already subscribed to ${pair}`)
      return
    }

    this.subscriptions.push(newSub)
    if (this.subscriptions.length === 1) {
      this.beginPolling()
    }
  }
}

module.exports = BittrexApi
