/* eslint-env node */
const WebSocket = require('ws')
const EventEmitter = require('events')
const crypto = require('crypto')
const {bind, createConverter} = require('./tools')
const _ = require('lodash')
const {pairs} = require('./const')
const debug = require('debug')('BitfinexApi')

const wsEndpoint = 'wss://api.bitfinex.com/ws/2'
const apiKey = process.env.BITFINEX_API_KEY
const apiSecret = process.env.BITFINEX_API_SECRET

const pairConverter = createConverter([{
  normal: pairs.USDTBTC,
  specific: 'BTCUSD'
}])

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

  _auth () {
    const authNonce = Date.now() * 1000
    const authPayload = 'AUTH' + authNonce
    const authSig = crypto
      .createHmac('sha384', apiSecret)
      .update(authPayload)
      .digest('hex')

    const payload = {
      apiKey,
      authSig,
      authNonce,
      authPayload,
      event: 'auth'
    }

    this.ws.send(JSON.stringify(payload))
  }

  parseMessage (msg) {
    msg = JSON.parse(msg)
    const prop = path => _.get(msg, path)

    // Connection confirmed
    if (prop('event') === 'info' && prop('version') === 2) {
      return true
    }

    // Auth confirmed
    if (prop('event') === 'auth' && prop('status') === 'OK') {
      return true
    }

    // Stop/Restart Websocket Server (please reconnect)
    if (prop('event') === 'info' && prop('code') === 20051) {
      // TODO:
      // 20051 : Stop/Restart Websocket Server (please reconnect)
      // 20060 : Entering in Maintenance mode. Please pause any activity and resume after receiving the info message 20061 (it should take 120 seconds at most).
      // 20061 : Maintenance ended. You can resume normal activity. It is advised to unsubscribe/subscribe again all channels.
      return true
    }

    // Book subscription confirmed
    if (prop('event') === 'subscribed' && prop('channel') === 'book') {
      const subscription = _.find(this.subscriptions, _.pick(msg, ['channel', 'pair']))
      if (!subscription) {
        debug(`ERROR: received subscription confirmation for channel ${msg.channel} / pair ${msg.pair} but no according subscription found`)
        return false
      }
      debug(`subscription to ${subscription.channel} confirmed`)
      _.assign(subscription, {
        lastUpdated: +new Date(),
        chanId: msg.chanId
      })
      return true
    }

    // data for subscription with given chanId
    if (_.isNumber(prop(0))) {
      const subscription = _.find(this.subscriptions, {chanId: prop(0)})
      if (!subscription) {
        debug(`ERROR: received data for chanId ${prop(0)} but no according subscription found`)
        return false
      }
      this.onSubscriptionData(subscription, prop(1))
      return true
    }
    return false
  }

  onSubscriptionData (subscription, data) {
    subscription.lastUpdated = +new Date()
    if (subscription.channel === 'book') {
      // single element
      if (_.isArray(data) && data.length && !_.isArray(data[0])) {
        return this.onSubscriptionData(subscription, [data])
      }
      // [[price, _x, size], ...]
      if (!_.isArray(data) || _.some(data, d => !_.isArray(d) || d.length !== 3)) {
        debug('ERROR: subscription data error')
        return
      }
      this.emit('bookUpdate', pairConverter.normalize(subscription.pair), data)
      return
    }
    debug(`WARNING: i don't know how to handle ${subscription.channel} data`)
  }

  getLastUpdated () {
    return this.subscriptions.map(s => ({pair: pairConverter.normalize(s.pair), lastUpdated: s.lastUpdated}))
  }
  onWSError (err) {
    debug('ws error', err)
  }
  onWSMessage (msg) {
    debug('msg', msg)
    this.emit('socketMessage', msg)
    try {
      if (!this.parseMessage(msg)) {
        debug('WARNING: unknown data message format')
      }
    } catch (e) {
      debug('ERROR: Could not process data from server:', e)
    }
  }

  onWSOpen () {
    this.emit('sockedOpened')
    debug(`refreshing ${this.subscriptions.length} subscriptions`)
    this._auth()
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
      pair: pairConverter.denormalize(pair)
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
    clearInterval(this.reconnectTimeout)
    if (this.ws) {
      this.ws
        .removeAllListeners('error')
        .removeAllListeners('message')
        .removeAllListeners('open')
        .removeAllListeners('close')
        .close()
      this.ws = null
    }
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
      const ws = new WebSocket(wsEndpoint)
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
