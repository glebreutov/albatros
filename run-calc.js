const BitfinexApi = require('./src/Bitfinex')
const BittrexApi = require('./src/Bittrex')
const {pairs, sides} = require('./src/const')
const _ = require('lodash')
const Book = require('./src/Book')
const calculate = require('./calc/arb_calc').calculate
const fees = require('./calc/fees')
// const exec = require('./src/executionApi')

function adaptBook (book, side) {
  return book.getLevels(side).map(x => ({price: parseFloat(x[Book.INDEX_PRICE]), size: parseFloat(x[Book.INDEX_SIZE])}))
}

function profitTreshold (arbRes) {
  return arbRes.profit > 0
}

function executionSimulator (arbRes, buyExch, sellExch) {
  // buy bittr
  console.log(buyExch, 'limit buy price:', arbRes.arbBuy, 'size:', arbRes.volume)
  // problems: order rejected, order not fully executed
  // open bitf
  console.log(sellExch, 'open long positon:', arbRes.volume)
  // problems: can't open position
  // sell bitf
  console.log(sellExch, 'limit sell price:', arbRes.arbSell, 'size:', arbRes.volume)
  // problems: order rejected, order not fully executed
  // transfer funds from bitr to bitf
  console.log('transfer from', buyExch, 'to', sellExch)
  // problems: transfer rejected, transfer stucked
  // close bitf
  console.log(sellExch, 'close long positon:', arbRes.volume)
  // problems: can't close position
  // transfer funds from bitf to bitr
  console.log('transfer from', sellExch, 'to', buyExch)
  // problems: transfer rejected, transfer stucked

  // loop
  console.log('polling balance', buyExch)
  console.log('polling balance', sellExch)
}

function calc (book1, book2, exch1Name, exch2Name) {
  const myFunds = 1
  const buyDepth = adaptBook(book1, sides.ASK)
  const sellDepth = adaptBook(book2, sides.BID)
  const fees1 = fees.getFees(exch1Name)
  const fees2 = fees.getFees(exch2Name)

  if (buyDepth.length > 5 && sellDepth.length > 5) {
    const arbRes = calculate(buyDepth, sellDepth, fees1.taker, fees2.taker, fees1.withdrawal.BTC, fees2.withdrawal.USDT, myFunds)
    if (profitTreshold(arbRes)) {
      executionSimulator(arbRes, exch1Name, exch2Name)
    }
    // console.log(arbRes)
  }
}

async function main () {
  const bitfinex = new BitfinexApi()
  bitfinex.subscribeBook(pairs.USDTBTC)
  const bitfinexBook = new Book()
  bitfinex.on('bookUpdate', (pair, data) => {
    bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[2] < 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
    bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
    bitfinexBook.updateLevels(sides.BID, data.filter(d => d[2] > 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
    bitfinexBook.updateLevels(sides.BID, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  })

  const bittrex = new BittrexApi()
  bittrex.subscribe([pairs.USDTBTC])
  const bittrexBook = new Book()
  bittrex.on('bookUpdate', (pair, data) => {
    bittrexBook.updateLevels(sides.ASK, data.sell.map(d => [d.Rate, d.Quantity]))
    bittrexBook.updateLevels(sides.BID, data.buy.map(d => [d.Rate, d.Quantity]))
  })

  function mapPrice (book, side) {
    let strPrice = book.getLevels(side)[0][Book.INDEX_PRICE].toString()
    return parseFloat(strPrice)
  }

  bitfinex.on('bookUpdate',
    () => calc(bitfinexBook, bittrexBook, 'BITF', 'BTRX')
  )

  bittrex.on('bookUpdate',
    () => calc(bittrexBook, bitfinexBook, 'BTRX', 'BITF')
  )
}

main().then()
