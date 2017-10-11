const BitfinexApi = require('./src/BitfinexWS')
const BittrexApi = require('./src/Bittrex')
const {pairs, sides} = require('./src/const')
const _ = require('lodash')
const Book = require('./src/Book')
const calculate = require('./calc/arb_calc').calculate
const fees = require('./calc/fees')
// const exec = require('./src/executionApi')
const exec = require('./src/Execution')
const sleep = require('./src/tools').sleep

function adaptBook (book, side) {
  return book.getLevels(side).map(x => ({price: parseFloat(x[Book.INDEX_PRICE]), size: parseFloat(x[Book.INDEX_SIZE])}))
}

function profitTreshold (arbRes) {
  return arbRes.profit > 0
}

async function syncExec (buyPrice, sellPrice, size, buyExch, sellExch, pair, sellWallet, buyWallet) {
  // getting loan btc for usdt on bitf.
  const pos = await exec.openShortPosition(sellExch, pair, size)
  if (!pos.ack) {
    console.error(`can't open position ${pos}`)
    return false
  }
  // buy btc on btrx
  const buyOrder = await exec.buy(buyExch, pair, buyPrice, size)
  if (!buyOrder.ack) {
    console.error(`can't buy ${buyOrder}`)
    return false
  }
  // sell loaned btc on bitf. price lock!
  const sellOrder = await exec.sell(sellExch, sellPrice, size)
  if (!sellOrder.ack) {
    console.error(`can't sell ${sellOrder}`)
    return false
  }

  await Promise.race([
    Promise.all([exec.waitForExec(sellOrder), exec.waitForExec(buyOrder)]),
    sleep(4000)
  ])

  await exec.cancel(buyOrder)
  await exec.cancel(sellOrder)

  // transfer BTC from BTRX to BITF
  // todo: and wait for btc deposit at BITF
  const transferStatus = await exec.transferFunds(buyExch, sellExch, pair.counter, buyWallet)
  if (!transferStatus.ack) {
    console.error(`can't withdraw funds from ${buyExch} to ${sellExch} details: ${transferStatus}`)
    return false
  }

  // return loan on BITF
  const posClosed = await exec.closePosition(sellExch, pos)
  if (!posClosed.ack) {
    console.error(`unable to close position ${posClosed}`)
    return false
  }

  // transfer usdt form bitf to btrx
  const backtransferStatsu = await exec.transferFunds(sellExch, buyExch, pair.base, sellWallet)
  if (!backtransferStatsu.ack) {
    console.error(`can't withdraw funds from ${sellExch} to ${buyExch} details ${backtransferStatsu}`)
    return false
  }

  return true
}

async function calc (book1, book2, exch1Name, exch2Name, pair) {
  const myFunds = 1
  const buyDepth = adaptBook(book1, sides.ASK)
  const sellDepth = adaptBook(book2, sides.BID)
  const fees1 = fees.getFees(exch1Name)
  const fees2 = fees.getFees(exch2Name)

  if (buyDepth.length > 5 && sellDepth.length > 5) {
    const arbRes = calculate(buyDepth, sellDepth, fees1.taker, fees2.taker, fees1.withdrawal.BTC, fees2.withdrawal.USDT, myFunds)
    if (profitTreshold(arbRes)) {
      await syncExec(arbRes.arbBuy, arbRes.arbSell, arbRes.volume, exch1Name, exch2Name, pair)
    }
    // console.log(arbRes)
  }
}

async function main (config) {
  const pair = config.pair
  const bitfinex = new BitfinexApi()
  bitfinex.subscribeBook(pair)
  const bitfinexBook = new Book()
  bitfinex.on('bookUpdate', (pair, data) => {
    bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[2] < 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
    bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
    bitfinexBook.updateLevels(sides.BID, data.filter(d => d[2] > 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
    bitfinexBook.updateLevels(sides.BID, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  })

  const bittrex = new BittrexApi()
  bittrex.subscribe([pair])
  const bittrexBook = new Book()
  bittrex.on('bookUpdate', (pair, data) => {
    bittrexBook.updateLevels(sides.ASK, data.sell.map(d => [d.Rate, d.Quantity]))
    bittrexBook.updateLevels(sides.BID, data.buy.map(d => [d.Rate, d.Quantity]))
  })

  bitfinex.on('bookUpdate',
    () => calc(bitfinexBook, bittrexBook, 'BITF', 'BTRX', pair)
  )

  bittrex.on('bookUpdate',
    () => calc(bittrexBook, bitfinexBook, 'BTRX', 'BITF', pair)
  )
}

const config = process.argv.slice(2).map(x => x.split('=')).reduce((acc, val) => {
  acc[val[0]] = val[1]
  return acc
}, {})
console.log(config)
main(config).then()
