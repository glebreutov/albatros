const BitfinexApi = require('./src/BitfinexWS')
const bitfinexDriver = require('./src/BitfinexDriver')

const BittrexApi = require('./src/Bittrex')
const {pairs, sides} = require('./src/const')
const _ = require('lodash')
const Book = require('./src/Book')
const calculate = require('./calc/arb_calc').calculate
const fees = require('./calc/fees')
// const exec = require('./src/executionApi')
const exec = require('./src/Execution')
const sleep = require('./src/tools').sleep
const bittrexDriver = require('../src/BittrexDriver')
const createNonceGenerator = require('../src/createNonceGenerator')

function adaptBook (book, side) {
  return book.getLevels(side).map(x => ({price: parseFloat(x[Book.INDEX_PRICE]), size: parseFloat(x[Book.INDEX_SIZE])}))
}

function profitTreshold (arbRes) {
  return arbRes.profit > 0
}

async function getRemainsAndCancel (order) {
  const orderStatus = await exec.orderStatus(order)
  if (!orderStatus.ack) {
    return {ack: false, resp: orderStatus}
  } else {
    if (orderStatus.remains > 0) {
      await exec.cancel(order)
    }
    return {ack: true, remains: orderStatus.remains}
  }
}

async function syncExec (buyPrice, sellPrice, size, buyExch, sellExch, pair, sellWallet, buyWallet) {
  console.log('input', buyPrice, sellPrice, size, buyExch, sellExch, pair, sellWallet, buyWallet)
  console.log('buying', buyExch, pair, buyPrice, size)
  // buy btc on btrx
  const buyOrder = await exec.buy(buyExch, pair, buyPrice, size)
  if (!buyOrder.ack) {
    console.error('can\'t buy', buyOrder)
    return false
  }
  // sell loaned btc on bitf. price lock!
  console.log('shorting', sellExch, sellPrice, size)
  const sellOrder = await exec.short(sellExch, pair, sellPrice, size)
  if (!sellOrder.ack) {
    console.error('can\'t short', sellOrder)
    return false
  }

  await sleep(10000)
  console.log('check remaining', buyOrder)
  const buyStatus = await getRemainsAndCancel(buyOrder)
  console.log('check remaining', buyStatus)
  if (!buyStatus.ack) {
    console.log('can\'t get but order status ', buyStatus)
    return false
  }
  console.log('check remaining', sellOrder)
  const sellStatus = await getRemainsAndCancel(sellOrder)
  if (!sellStatus.ack) {
    console.log('can\'t get but order status ', sellStatus)
    return false
  }
  console.log('check remaining', sellStatus)

  // transfer BTC from BTRX to BITF
  // todo: and wait for btc deposit at BITF
  console.log('transfering funds', buyExch, sellExch, size - buyStatus.remains, pair.counter, buyWallet)
  const transferStatus = await exec.transferFunds(buyExch, sellExch, size - buyStatus.remains, pair.counter, buyWallet)
  if (!transferStatus.ack) {
    console.error('can\'t withdraw funds from', buyExch, 'to', sellExch,
      'details:', transferStatus)
    return false
  }

  // return loan on BITF
  console.log('closing position', sellExch)
  const posClosed = await exec.closePositions(sellExch)
  if (!posClosed.ack) {
    console.error('unable to close position', posClosed)
    return false
  }

  // transfer usdt form bitf to btrx
  // consider using 3.3x rule
  const usdtSize = size * buyPrice - sellStatus.remains
  console.log('backtransferring funds ', sellExch, buyExch, usdtSize, pair.base, sellWallet)
  const backtransferStatsu = await exec.transferFunds(sellExch, buyExch, usdtSize, pair.base, sellWallet)
  if (!backtransferStatsu.ack) {
    console.error('can\'t withdraw funds from', sellExch, 'to',
      buyExch, 'details', backtransferStatsu)
    return false
  }
  console.log('looks ok')
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
      // await syncExec(arbRes.arbBuy, arbRes.arbSell, arbRes.volume, exch1Name, exch2Name, pair)
      console.log(new Date())
      console.log(arbRes)
    }
    // console.log(arbRes)
  }
}

const bitfinexBooks = {}
function onBitfinexBookUpdate (pair, data) {
  const bitfinexBook = bitfinexBooks[pair.display]
  bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[2] < 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
  bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  bitfinexBook.updateLevels(sides.BID, data.filter(d => d[2] > 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
  bitfinexBook.updateLevels(sides.BID, data.filter(d => d[1] === 0).map(d => [d[0], 0]))

  const bittrexBook = bittrexBooks[pair.display]
  calc(bittrexBook, bitfinexBook, 'BTRX', 'BITF', pair).then()
}

const bittrexBooks = {}
function onBittrexBookUpdate (pair, data) {
  const bittrexBook = bittrexBooks[pair.display]
  bittrexBook.updateLevels(sides.ASK, data.sell.map(d => [d.Rate, d.Quantity]))
  bittrexBook.updateLevels(sides.BID, data.buy.map(d => [d.Rate, d.Quantity]))

  const bitfinexBook = bitfinexBooks[pair.display]
  calc(bittrexBook, bitfinexBook, 'BTRX', 'BITF', pair).then()
}

function parseConfig () {
  return {
    BITF: {
      key: process.env.BITF.split(':')[0],
      secret: process.env.BITF.split(':')[1]
    },
    BTRX: {
      key: process.env.BTRX.split(':')[0],
      secret: process.env.BTRX.split(':')[1]
    },
    pair: pairs[process.env.PAIR]
  }
}

async function main () {
  const config = parseConfig()

  console.log(config)

  const bitfinex = new BitfinexApi()
  // const createNonceGenerator = require('./src/createNonceGenerator')
  // const nonceGen = createNonceGenerator()
  // bitfinexDriver.setKeys(config.BITF.key, config.BITF.secret, nonceGen)
  const bittrex = new BittrexApi()

  exec.registerDriver('BTRX', bittrexDriver)
  exec.registerDriver('BITF', bitfinexDriver)
  const nonceGen = createNonceGenerator()
  bitfinexDriver.setKeys(config.BITF.key, config.BITF.secret, nonceGen)
  bittrexDriver.setKeys(config.BTRX.key, config.BTRX.secret)

  for (const k in pairs) {
    bitfinexBooks[pairs[k].display] = new Book()
    bitfinex.subscribeBook(pairs[k])
  }
  bitfinex.on('bookUpdate', onBitfinexBookUpdate)

  for (const k in pairs) {
    bittrexBooks[pairs[k].display] = new Book()
  }
  bittrex.subscribe(Object.keys(pairs).map(key => pairs[key]))
  bittrex.on('bookUpdate', onBittrexBookUpdate)
}

// main(config).then()

exports.syncExec = syncExec
