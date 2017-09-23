/* eslint-env node */
const WebSocket = require('ws')
const EventEmitter = require('events')
const {bind} = require('./tools')
const _ = require('lodash')
const {pairs} = require('./const')
const debug = require('debug')('BitfinexApi')


const bitfinexPairs = {
  [pairs.BTCUSD]: 'BTCUSD'
}
const convertToBitfinexPair = uniform => {
  const specificPair = bitfinexPairs[uniform]
  if (!specificPair) {
    throw new Error(`Pair ${uniform} not supported`)
  }
  return specificPair
}
const convertToUniformPair = specificPair => {
  const uniform = _.findKey(bitfinexPairs, v => v === specificPair)
  if (!specificPair) {
    throw new Error(`Could not convert ${specificPair} to uniform pair`)
  }
  return uniform
}

class BitfinexApi extends EventEmitter {
  constructor (...args) {
    super(...args)
    debug('Creating BitfinexApi')
    this.ws = null
    bind([
      'createSocket',
      '_subscribe',
      'onWSError',
      'onWSMessage',
      'onWSOpen',
      'onWSClose'
    ], this)
    this.subscriptions = []
    this.reconnectTimeout = null
    this.createSocket(true).then()
  }
  onWSError (err) {
    debug('ws error', err)
  }
  onWSMessage (msg) {
    debug('msg', msg)
    this.emit('socketMessage', msg)
    try {
      msg = JSON.parse(msg)
      // book subscription answers:
      // msg {"event":"subscribed","channel":"book","chanId":83624,"prec":"P0","freq":"F0","len":"25","pair":"BTCUSD"}
      // msg [83624,[[3774.3,3,24.71378776],[3774.2,1,0.7604], ...]
      // msg [83624,"hb"]
      // msg [80198,3783,1,0.5]
      if (_.isObject(msg) && msg.event === 'subscribed') {
        const subscription = _.find(this.subscriptions, _.pick(msg, ['channel', 'pair']))
        if (!subscription) {
          debug(`ERROR: received subscription confirmation for channel ${msg.channel} / pair ${msg.pair} but no according subscription found`)
          return
        }
        debug(`subscription to ${subscription.channel} confirmed`)
        _.assign(subscription, {
          lastUpdated: +new Date(),
          chanId: msg.chanId
        })
        return
      }

      if (_.isArray(msg)) {
        const subscription = _.find(this.subscriptions, {chanId: msg[0]})
        if (!subscription) {
          debug(`ERROR: received data confirmation for chanId ${msg[0]} but no according subscription found`)
          return
        }
        subscription.lastUpdated = +new Date()
        if (_.isString(msg[1])) {
          return
        }
        if (_.isArray(msg[1])) {
          msg[1].forEach(item => this.onSubscriptionData(subscription, item))
        } else {
          msg.shift()
          this.onSubscriptionData(subscription, msg)
        }
      }
    } catch (e) {
      debug('ERROR: Could not process data from server:', e)
    }
  }
  onSubscriptionData (subscription, data) {
    if (subscription.channel === 'book') {
      if (!_.isArray(data) || data.length !== 3) {
        debug('ERROR: subscription data for channel "book" should an array of exactly 3 items')
        return
      }
      this.emit('bookUpdate', convertToUniformPair(subscription.pair), data)
      return
    }
    debug(`WARNING: i don't know how to handle ${subscription.channel} data`)
  }
  onWSOpen () {
    this.emit('sockedOpened')
    debug(`refreshing ${this.subscriptions.length} subscriptions`)
    this.subscriptions.forEach(this._subscribe)
  }
  onWSClose (...args) {
    this.ws = null
    this.emit('sockedClosed')
    debug('socket closed:', JSON.stringify(...args))
    const reconnectAfter = 1
    debug(`reconnecting in ${reconnectAfter}s...`)
    this.reconnectTimeout = setTimeout(this.createSocket, reconnectAfter * 1000)
  }

  async subscribeBook (pair) {
    const newSub = {
      channel: 'book',
      pair: convertToBitfinexPair(pair)
    }
    // exists by channel / pair
    if (_.some(this.subscriptions, newSub)) {
      debug(`already subscribed to ${pair}`)
      return
    }
    debug(`adding book subscription for ${pair}`)
    this.subscriptions.push(newSub)
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this._subscribe(newSub)
    } else {
      debug('immediate subscription skipped as websocket is reconnecting')
    }
  }
  _subscribe (subscription) {
    debug(`sending subscription message for ${JSON.stringify(subscription)}`)
    try {
      this.ws.send(JSON.stringify({
        ..._.pick(subscription, ['channel', 'pair']),
        event: 'subscribe'
      }))
    } catch (e) {
      debug('ERROR: subscription message failed:', e)
    }
  }

  destroy () {
    debug('destroying')
    if (this.ws) {
      this.ws
        .removeAllListeners('error')
        .removeAllListeners('message')
        .removeAllListeners('open')
        .removeAllListeners('close')
        .close()
    }
    clearInterval(this.reconnectTimeout)
    debug('destroyed')
  }
  // for debug purposes
  forceCloseWs () {
    debug('force shutting down ws')
    this.ws.close()
  }

  async createSocket (firstTime) {
    debug((firstTime ? '' : 're') + 'connecting')
    return new Promise(resolve => {
      const ws = new WebSocket('wss://api.bitfinex.com/ws')
        .on('error', this.onWSError)
        .on('message', this.onWSMessage)
        .on('open', () => {
          debug('socket opened')
          this.ws = ws
          resolve(ws)
          this.onWSOpen()
        })
        .on('close', this.onWSClose)
    })
  }
}

module.exports = BitfinexApi
