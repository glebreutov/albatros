const BitfinexApi = require('./src/Bitfinex')
const BittrexApi = require('./src/Bittrex')
const {pairs, sides} = require('./src/const')
const _ = require('lodash')
const Book = require('./src/Book')
const debug = require('debug')('main')
const {sleep} = require('./src/tools')

const drv1 = require('./src/BitfinexDriver')
const api = new BitfinexApi()

async function start () {

  // should fail
  let order = await drv1.newOrder(pairs.USDTBTC, 5000, 2, sides.ASK)
  if (!order.ack) {
    // should place an order
    order = await drv1.newOrder(pairs.USDTBTC, 5000, 0.01, sides.ASK)
  }

  const waitC = {continue: true}
  const deadOrder = await Promise.race([
    drv1.waitForExec(order, waitC),
    sleep(6000, false)
  ])

  if (deadOrder) {
    // ...
  } else {
    waitC.continue = false
  }

  const orders = await api.getActiveOrders()
  await Promise.all(orders.map(ord => api.cancelOrder(ord.id)))


  // bitfinex.subscribeBook(pairs.USDTBTC)
  // const bitfinexBook = new Book()
  // bitfinex.on('bookUpdate', (pair, data) => {
  //   bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[2] < 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
  //   bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  //   bitfinexBook.updateLevels(sides.BID, data.filter(d => d[2] > 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
  //   bitfinexBook.updateLevels(sides.BID, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  // })
  //
  // const bittrex = new BittrexApi()
  // bittrex.subscribe([pairs.USDTBTC])
  // const bittrexBook = new Book()
  // bittrex.on('bookUpdate', (pair, data) => {
  //   bittrexBook.updateLevels(sides.ASK, data.sell.map(d => [d.Rate, d.Quantity]))
  //   bittrexBook.updateLevels(sides.BID, data.buy.map(d => [d.Rate, d.Quantity]))
  // })
  //
  // setInterval(() => {
  //   console.log('\033c')
  //   console.log(`bitfinex: ${bitfinexBook.getLevels(sides.BID).length + bitfinexBook.getLevels(sides.ASK).length} levels, ${JSON.stringify(bitfinex.getLastUpdated().map(s => ({...s, ['lastUpdated']: ((+new Date() - s.lastUpdated) / 1000).toFixed(1) + ' s ago'})))}`)
  //   // console.log(`bittrex: ${bittrexBook.getLevels(sides.BID).length + bittrexBook.getLevels(sides.ASK).length} levels, ${JSON.stringify(bittrex.getLastUpdated().map(s => ({...s, ['lastUpdated']: ((+new Date() - s.lastUpdated) / 1000).toFixed(1) + ' s ago'})))}`)
  //   console.log('')
  //   console.log('ask')
  //   bitfinexBook.getLevels(sides.ASK).slice(0, 10).forEach(l => console.log(`${l[Book.INDEX_PRICE].toFixed(4)}: ${l[Book.INDEX_SIZE].toFixed(4)}`))
  //   console.log('')
  //   console.log('bid')
  //   bitfinexBook.getLevels(sides.BID).slice(0, 10).forEach(l => console.log(`${l[Book.INDEX_PRICE].toFixed(4)}: ${l[Book.INDEX_SIZE].toFixed(4)}`))
  //
  // }, 1000)
}
start().then()
