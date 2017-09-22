/* eslint-env node */
const WebSocket = require('ws')
const EventEmitter = require('events')
const {bind} = require('./tools')

// todo abstract save/restore subscriptions
class BitfinexAdapter extends EventEmitter {
  constructor (...args) {
    super(...args)
    console.log('Creating BitfinexAdapter')
    this.ws = null
    bind([
      'createSocket',
      'sendSubscribeBook',
      'onWSError',
      'onWSMessage',
      'onWSOpen',
      'onWSClose'
    ], this)
    this.bookSubscriptions = []
    this.isReconnecting = false
    this.reconnectTimeout = null
    this.createSocket(true).then()
  }
  onWSError (err) {
    console.log('ws error', err)
    this.emit('error', err)
  }
  onWSMessage (msg) {
    console.log('msg', msg)
    try {
      msg = JSON.parse(msg)
      this.emit('wsMessage', msg)
    } catch (e) {}
  }
  onWSOpen () {
    this.isReconnecting = null
    console.log(`refreshing ${this.bookSubscriptions.length} subscriptions`)
    this.bookSubscriptions.forEach(this.sendSubscribeBook)
    // todo debug
    this.emit('wsOpen')
  }
  onWSClose (...args) {
    console.log('socket closed', JSON.stringify(...args))
    this.ws = null
    console.log('reconnecting in 1s...')
    this.isReconnecting = true
    this.reconnectTimeout = setTimeout(this.createSocket, 1000)
  }
  onMessage (msg) {
    console.log(msg)
  }
  async subscribeBook (pair) {
    if (this.bookSubscriptions.includes(pair)) {
      console.log('already subscribed to', pair)
      return
    }
    console.log('subscribing to', pair)
    if (pair !== 'BTC-USD') {
      throw new Error(`Pair ${pair} not supported`)
    }
    this.bookSubscriptions.push(pair)
    if (!this.isReconnecting && this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendSubscribeBook(pair)
    } else {
      console.log('immediate subscription skipped as websocket is reconnecting')
    }
  }
  sendSubscribeBook (pair) {
    const pairs = {
      'BTC-USD': 'BTCUSD'
    }
    if (!pairs[pair]) {
      throw new Error(`Pair ${pair} not supported`)
    }
    console.log(`sending ${pairs[pair]} subscription message`)
    this.ws.send(JSON.stringify({
      'event': 'subscribe',
      'channel': 'book',
      'pair': pairs[pair]
    }))
  }

  destroy () {
    console.log('destroying')
    if (this.ws) {
      this.ws
        .removeAllListeners('error')
        .removeAllListeners('message')
        .removeAllListeners('open')
        .removeAllListeners('close')
        .close()
    }
    clearInterval(this.reconnectTimeout)
  }
  // todo debug
  forceCloseWs () {
    console.log('force shutting down ws')
    this.ws.close()
  }

  async createSocket (firstTime) {
    console.log((firstTime ? '' : 're') + 'connecting')
    this.isReconnecting = true
    return new Promise(resolve => {
      const ws = new WebSocket('wss://api.bitfinex.com/ws')
        .on('error', this.onWSError)
        .on('message', this.onWSMessage)
        .on('open', () => {
          console.log('socket opened')
          this.ws = ws
          resolve(ws)
          this.onWSOpen()
        })
        .on('close', this.onWSClose)
    })
  }
}

module.exports = BitfinexAdapter
