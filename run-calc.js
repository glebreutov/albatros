const BitfinexApi = require('./src/BitfinexWS')
const bitfinexDriver = require('./src/BitfinexDriver')
const BitfinexRest = require('./src/BitfinexRest')
const BittrexApi = require('./src/Bittrex')
const {pairs, sides, exchanges} = require('./src/const')
const _ = require('lodash')
const Book = require('./src/Book')
const calculate = require('./calc/arb_calc_new').calculate
const fees = require('./calc/fees')
// const exec = require('./src/executionApi')
const exec = require('./src/Execution')
const {assert, sleep} = require('./src/tools')
const bittrexDriver = require('./src/BittrexDriver')
const createNonceGenerator = require('./src/createNonceGenerator')
const tg = require('./src/tg')

function adaptBook (book, side) {
  return book.getLevels(side).map(x => ({price: parseFloat(x[Book.INDEX_PRICE]), size: parseFloat(x[Book.INDEX_SIZE])}))
}

function profitTreshold (arbRes) {
  return arbRes.profit >= 0.0005
}

// ws apis
let bitfinex, bittrex
// pairs to subscribe to market data
let pairsToSubscribe

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

async function syncExec (buyPrice, sellPrice, buySize, sellSize, buyExch, sellExch, pair) {
  const shortPromise = exec.short(sellExch, pair, sellPrice, sellSize)
  const buyPromise = exec.buy(buyExch, pair, buyPrice, buySize)

  const sellOrder = await shortPromise
  if (!sellOrder.ack) {
    tgLog('*can\'t short*', sellOrder)
    console.error('can\'t short', sellOrder)
    return false
  }
  const buyOrder = await buyPromise
  if (!buyOrder.ack) {
    console.error('can\'t buy', buyOrder)
    tgLog('*can\'t buy*', buyOrder)
    return false
  }
  tgLog('*shorting*', sellSize, 'of', 'pair', 'at', sellExch, 'at price', sellPrice)
  tgLog('*buying*', buySize, 'of', pair, 'at', buyExch, 'at price', buyPrice)
  await sleep(100000)
  console.log('check remaining and cancel buy order', buyOrder)
  tgLog('*check remaining* and cancel buy order', buyOrder)
  const buyStatus = await getRemainsAndCancel(buyOrder)
  console.log('remaining: ', buyStatus)
  tgLog('*remaining*: ', buyStatus)
  if (!buyStatus.ack) {
    console.log('can\'t get buy order status', buyStatus)
    tgLog('*can\'t get buy order status*', buyStatus)
    return false
  }
  console.log('check remaining and cancel sell order', sellOrder)
  tgLog('*check remaining* and cancel sell order', sellOrder)
  const sellStatus = await getRemainsAndCancel(sellOrder)
  console.log('remaining:', sellStatus)
  tgLog('*remaining*:', sellStatus)
  if (!sellStatus.ack) {
    console.log('can\'t get sell order status', sellStatus)
    tgLog('*can\'t get sell order status*', sellStatus)
    return false
  }

  // transfer BTC from BTRX to BITF
  // todo: and wait for btc deposit at BITF
  console.log('transfering', buySize - buyStatus.remains, 'of', pair.counter, 'from', buyExch, 'to', sellExch)
  tgLog('*transfering*', buySize - buyStatus.remains, 'of', pair.counter, 'from', buyExch, 'to', sellExch)
  const transferStatus = await exec.transferFunds(buyExch, sellExch, buySize - buyStatus.remains, pair.counter)
  if (!transferStatus.ack) {
    console.error('can\'t withdraw funds from', buyExch, 'to', sellExch,
      'details:', transferStatus)
    tgLog('*can\'t withdraw* funds from', buyExch, 'to', sellExch,
      'details:', transferStatus)
    return false
  }

  // return loan on BITF
  console.log('closing position', sellExch)
  tgLog('*closing position*', sellExch)
  const posClosed = await exec.closePositions(sellExch)
  if (!posClosed.ack) {
    console.error('unable to close position', posClosed)
    tgLog('*unable to close position*', posClosed)
    return false
  }

  // transfer usdt form bitf to btrx
  // consider using 3.3x rule
  const usdtSize = sellSize * buyPrice - sellStatus.remains
  console.log('backtransferring', usdtSize, 'of', pair.base, 'from', sellExch, 'to', buyExch)
  tgLog('*backtransferring*', usdtSize, 'of', pair.base, 'from', sellExch, 'to', buyExch)
  const backtransferStatsu = await exec.transferFunds(sellExch, buyExch, usdtSize, pair.base)
  if (!backtransferStatsu.ack) {
    console.error('can\'t withdraw funds from', sellExch, 'to',
      buyExch, 'details', backtransferStatsu)
    tgLog('*can\'t withdraw* funds from', sellExch, 'to',
      buyExch, 'details', backtransferStatsu)
    return false
  }
  console.log('looks ok')
  tgLog('looks ok')
  return true
}

let execInProgress = false
let prevSendTime = 0
let prevArb = null
async function calc (book1, book2, buyExchName, sellExchName, pair) {
  if (execInProgress) {
    return
  }

  const buyDepth = adaptBook(book1, sides.ASK)
  const sellDepth = adaptBook(book2, sides.BID)
  const buyFees = fees.getFees(buyExchName)
  const sellFees = fees.getFees(sellExchName)
  // const buyBalance = exec.balance(buyExchName, pair.base)
  const buyBalance = 0.6

  if (buyDepth.length > 5 && sellDepth.length > 5) {
    const arbRes = calculate(buyDepth, sellDepth, buyFees.taker, sellFees.taker,
      buyFees.withdrawal[pair.counter], sellFees.withdrawal[pair.base], buyBalance, pair)
    if (profitTreshold(arbRes)) {
      console.log(new Date())
      console.log(arbRes)

      execInProgress = true
      //await tgLog(`going to get some money calculated profit: ${arbRes.profit}`)
      const result = await syncExec(arbRes.arbBuy, arbRes.arbSell, arbRes.buySize, arbRes.shortSize, buyExchName, sellExchName, pair)
      execInProgress = false
      process.exit()
    }

    function isWorthToPrint (res) {
      return res.profit > 0 &&
        Date.now() - prevSendTime > 60000 &&
        (!prevArb || res.profit / Math.abs(prevArb.profit - res.profit) > 0.1)
    }

    if (isWorthToPrint(arbRes)) {
      prevSendTime = Date.now()
      prevArb = arbRes
      tgLog(`${pair.counter} BITF ASK: ${arbRes.sell}, BTRX BID: ${arbRes.buy}. Clean profit is ${arbRes.profit}`)
    }
    // console.log(arbRes)
  }
}

const bitfinexBooks = {}
function onBitfinexBookUpdate (pair, data) {
  bitfinexBooks.lastUpdated = Date.now()
  const bitfinexBook = bitfinexBooks[pair.display]
  bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[2] < 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))
  bitfinexBook.updateLevels(sides.ASK, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  bitfinexBook.updateLevels(sides.BID, data.filter(d => d[2] > 0 && d[1] !== 0).map(d => [d[0], Math.abs(d[2])]))

  bitfinexBook.updateLevels(sides.BID, data.filter(d => d[1] === 0).map(d => [d[0], 0]))
  const bittrexBook = bittrexBooks[pair.display]
  if (!bittrexBooks.lastUpdated) {
    // console.log('Bittrex market data not ready')
    return
  }
  if (Date.now() - bittrexBooks.lastUpdated > 30000) {
    // console.log('Bittrex market data outdated')
    reconnectBittrexWs(onBittrexBookUpdate)
    return
  }
  calc(bittrexBook, bitfinexBook, exchanges.BITTREX, exchanges.BITFINEX, pair).then()
}

const bittrexBooks = {}
function onBittrexBookUpdate (pair, data) {
  bittrexBooks.lastUpdated = Date.now()
  const bittrexBook = bittrexBooks[pair.display]
  bittrexBook.updateLevels(sides.ASK, data.sell.map(d => [d.Rate, d.Quantity]))

  bittrexBook.updateLevels(sides.BID, data.buy.map(d => [d.Rate, d.Quantity]))
  const bitfinexBook = bitfinexBooks[pair.display]
  if (!bitfinexBooks.lastUpdated) {
    // console.log('Bitfinex market data not ready')
    return
  }
  if (Date.now() - bitfinexBooks.lastUpdated > 30000) {
    // console.log('Bitfinex market data outdated')
    reconnectBitfinexWs(onBitfinexBookUpdate)
    return
  }
  calc(bittrexBook, bitfinexBook, exchanges.BITTREX, exchanges.BITFINEX, pair).then()
}

function parseConfig () {
  const [bitfKey, bitfSecret] = process.env.BITF.split(':')
  const [btrxKey, btrxSecret] = process.env.BTRX.split(':')
  let [tgToken, tgUsers] = process.env.TG.split('!')
  const pairs = process.env.PAIRS.split(',')
  assert(bitfKey && bitfSecret, 'env variable BITF should be API_KEY:API_SECRET')
  assert(btrxKey && btrxSecret, 'env variable BTRX should be API_KEY:API_SECRET')
  assert(tgToken && tgUsers, `env variable TG should be TELEGRAM_BOT_TOKEN!user_id1,user_id2`)
  tgUsers = tgUsers.split(',')
  return {
    BITF: {
      key: bitfKey,
      secret: bitfSecret
    },
    BTRX: {
      key: btrxKey,
      secret: btrxSecret
    },
    pairs,
    tgToken,
    tgUsers
  }
}

function reconnectBitfinexWs () {
  assert(_.isFunction(onBitfinexBookUpdate), 'onBitfinexBookUpdate should be a function')
  assert(_.isObject(pairsToSubscribe) && Object.keys(pairsToSubscribe).length, 'pairsToSubscribe should be an object')
  if (bitfinex) {
    console.log('Disconnecting bitfinex ws api')
    bitfinex.removeListener('bookUpdate', onBitfinexBookUpdate)
    bitfinex.destroy()
  }
  console.log('Connecting bitfinex ws api')
  bitfinex = new BitfinexApi()
  bitfinexBooks.lastUpdated = 0
  for (const k in pairsToSubscribe) {
    bitfinexBooks[pairsToSubscribe[k].display] = new Book()
    bitfinex.subscribeBook(pairsToSubscribe[k])
  }
  bitfinex.on('bookUpdate', onBitfinexBookUpdate)
}

function reconnectBittrexWs () {
  assert(_.isFunction(onBittrexBookUpdate), 'onBitfinexBookUpdate should be a function')
  if (bittrex) {
    console.log('Disconnecting Bittrex ws api')
    bittrex.removeListener('bookUpdate', onBittrexBookUpdate)
    bittrex.destroy()
  }
  console.log('Connecting Bittrex ws api')
  bittrex = new BittrexApi()
  bittrexBooks.lastUpdated = 0
  for (const k in pairsToSubscribe) {
    bittrexBooks[pairsToSubscribe[k].display] = new Book()
  }
  bittrex.subscribe(Object.keys(pairsToSubscribe).map(key => pairsToSubscribe[key]))
  bittrex.on('bookUpdate', onBittrexBookUpdate)
}

let tgLog = async () => {}
async function createTg (telegramBotToken, users) {
  try {
    let msgCounter = 0
    await tg.connect(telegramBotToken)
    tgLog = async (...args) => {
      try {
        const str = `${++msgCounter}: ${args.map(arg => {
          if (typeof arg === 'string') { return arg }
          if (typeof arg === 'undefined') { return 'undefined' }
          if (arg instanceof Date) { return arg.toISOString() }
          return '```\n' + JSON.stringify(_.cloneDeepWith(arg, argv => (argv instanceof Error) ? `Error: ${argv.message}` : argv), null, 2) + '```'
        }).join(' ')}`
        let sent = 0
        for (let i in users) {
          await tg.sendMessage(users[i], str, {parse_mode: 'markdown'})
          sent += 1
        }
        if (sent && sent === users.length) {
          return true
        }
      } catch (er) {
        console.log('Could not send Telegram message:', er)
      }
    }
  } catch (e) {}
}

async function main () {
  const config = parseConfig()

  pairsToSubscribe = _.pick(pairs, config.pairs)
  console.log(config)

  await createTg(config.tgToken, config.tgUsers)

  reconnectBitfinexWs()
  reconnectBittrexWs()

  exec.registerDriver(exchanges.BITTREX, bittrexDriver)
  exec.registerDriver(exchanges.BITFINEX, bitfinexDriver)
  const nonceGen = createNonceGenerator()
  bitfinexDriver.setKeys(config.BITF.key, config.BITF.secret, nonceGen)
  bittrexDriver.setKeys(config.BTRX.key, config.BTRX.secret)

  let balances = []
  // TODO RATE LIMIT!
  // for (let p in pairsToSubscribe) {
  //   const {base, counter} = pairsToSubscribe[p]
  //   balances = balances.concat([{
  //     asset: base,
  //     exchange: exchanges.BITFINEX,
  //     balance: await bitfinexDriver.balance(base)
  //   }, {
  //     asset: counter,
  //     exchange: exchanges.BITFINEX,
  //     balance: await bitfinexDriver.balance(counter)
  //   }, {
  //     asset: base,
  //     exchange: exchanges.BITTREX,
  //     balance: await bittrexDriver.balance(base)
  //   }, {
  //     asset: counter,
  //     exchange: exchanges.BITTREX,
  //     balance: await bittrexDriver.balance(counter)
  //   }])
  // }
  balances = balances.concat([{
    asset: pairs.BTCETH.base,
    exchange: exchanges.BITFINEX,
    balance: await bitfinexDriver.balance(pairs.BTCETH.base)
  }, {
    asset: pairs.BTCETH.base,
    exchange: exchanges.BITTREX,
    balance: await bittrexDriver.balance(pairs.BTCETH.base)
  }])

  const err = _.find(balances, b => !b.balance.ack)
  if (err) {
    console.log('No ack from driver:', err.exchange, err.balance)
    process.exit(1)
  }

  const msg = `Calc started. Balance:
  *Bitfinex*: 
    ${balances.filter(b => b.exchange === exchanges.BITFINEX && b.balance.balance).map(b => `${b.asset}: ${b.balance.balance}`).join('\n    ')}
  *Bittrex*:
    ${balances.filter(b => b.exchange === exchanges.BITTREX && b.balance.balance).map(b => `${b.asset}: ${b.balance.balance}`).join('\n    ')}
  `

  if (!await tgLog(msg)) {
    console.log('could not send reporting message')
    process.exit(1)
  }
}

if (require.main === module) {
  main().then()
} else {
  exports.syncExec = syncExec
}
