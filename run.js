const BitfinexApi = require('./src/bitfinex')
const BittrexApi = require('./src/bittrex')
const {pairs} = require('./src/const')
const debug = require('debug')('main')

async function start () {
  const btx = new BittrexApi()
  btx.on('bookUpdate', (pair, data) => {
    debug(pair, data)
  })
  btx.subscribeBook(pairs.USDTBTC)
}
start().then()
