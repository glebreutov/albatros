const BitfinexApi = require('./src/Bitfinex')
const BittrexApi = require('./src/Bittrex')
const {pairs, sides} = require('./src/const')
const Book = require('./src/Book')
const debug = require('debug')('main')

async function start () {
  // const bitfinex = new BitfinexApi()
  // bitfinex.subscribeBook(pairs.USDTBTC)
  // const book1 = new Book()
  // bitfinex.on('bookUpdate', (pair, data) => {
  //
  //   book1.updateLevels(sides.ASK, data.filter(d => d[2] < 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
  //   book1.updateLevels(sides.ASK, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  //   book1.updateLevels(sides.BID, data.filter(d => d[2] > 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
  //   book1.updateLevels(sides.BID, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  //
  //   console.log('\033c')
  //
  //   console.log('bid')
  //   book1.getLevels(sides.BID).slice(0, 10).forEach(l => console.log(`${l[Book.INDEX_PRICE].toFixed(4)}:\t${l[Book.INDEX_SIZE]}`))
  //   console.log('')
  //
  //   console.log('ask')
  //   book1.getLevels(sides.ASK).slice(0, 10).forEach(l => console.log(`${l[Book.INDEX_PRICE].toFixed(4)}:\t${l[Book.INDEX_SIZE]}`))
  //
  // })


  const bitfinex = new BittrexApi()
  bitfinex.subscribeBook(pairs.USDTBTC)
  const book2 = new Book()
  bitfinex.on('bookUpdate', (pair, data) => {
    book2.setLevels(sides.ASK, data.sell.map(d => [d.Rate, d.Quantity]))
    book2.setLevels(sides.BID, data.buy.map(d => [d.Rate, d.Quantity]))

      console.log('\033c')

      console.log('bid')
      book2.getLevels(sides.BID).slice(0, 10).forEach(l => console.log(`${l[Book.INDEX_PRICE].toFixed(4)}:\t${l[Book.INDEX_SIZE]}`))
      console.log('')

      console.log('ask')
      book2.getLevels(sides.ASK).slice(0, 10).forEach(l => console.log(`${l[Book.INDEX_PRICE].toFixed(4)}:\t${l[Book.INDEX_SIZE]}`))

  })
}
start().then()
