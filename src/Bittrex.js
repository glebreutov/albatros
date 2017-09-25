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
      '_beginPolling'
    ], this)
    this.subscriptions = []
    this.poller = 0
    this.destroying = false
  }

  async _beginPolling () {
    const subscriptionToPoll = this.subscriptions.shift()
    this.subscriptions.push(subscriptionToPoll)
    try {
      if (subscriptionToPoll.type === 'getorderbook') {
        const resp = await fetch(`https://bittrex.com/api/v1.1/public/getorderbook?market=${subscriptionToPoll.pair}&type=both`)
        subscriptionToPoll.lastUpdated = +new Date()
        const msg = await resp.json()
        if (this.destroying) {
          return
        }
        if (msg.success) {
          msg.result.buy.forEach(({Quantity, Rate}) =>
            this.emit('bookUpdate', converter.normalize(subscriptionToPoll.pair), [Rate, 'buy', Quantity]))
          msg.result.sell.forEach(({Quantity, Rate}) =>
            this.emit('bookUpdate', converter.normalize(subscriptionToPoll.pair), [Rate, 'sell', Quantity]))
        } else {
          debug(`ERROR: ${JSON.stringify(msg)}`)
        }
        return
      }
      debug(`WARNING: i don't know how to handle ${subscriptionToPoll.type} data`)
    } catch (e) {
      debug(`Polling ${JSON.stringify(subscriptionToPoll)}failed: ${e}`)
    } finally {
      if (!this.destroying) {
        this.poller = setTimeout(this._beginPolling, 1000)
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
      pair: converter.denormalize(pair)
    }
    // exists by type / pair
    if (_.some(this.subscriptions, newSub)) {
      debug(`already subscribed to ${pair}`)
      return
    }

    this.subscriptions.push(newSub)
    if (this.subscriptions.length === 1) {
      this._beginPolling()
    }
  }
}

module.exports = BittrexApi
