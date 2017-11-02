const BitfinexApi = require('./src/BitfinexWS')
const bitfinexDriver = require('./src/BitfinexDriver')
const BitfinexRest = require('./src/BitfinexRest')
const BittrexApi = require('./src/Bittrex')
const {pairs, sides, exchanges} = require('./src/const')
const _ = require('lodash')
const Book = require('./src/Book')
const calculate = require('./calc/arb_calc').calculate
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
  return arbRes.profit > 0
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

async function syncExec (buyPrice, sellPrice, size, buyExch, sellExch, pair) {
  // bitf usdt
  const sellWalletMsg = await exec.wallet(sellExch, pair.base)
  console.log('sell wallet', sellWalletMsg)
  if (!sellWalletMsg.ack) {
    console.log('getting sell wallet failed', sellWalletMsg)
    tgLog('*getting sell wallet failed*', sellWalletMsg)
    return false
  }
  // btrx btc in our case
  const buyWalletMsg = await exec.wallet(buyExch, pair.counter)
  console.log('buy wallet', buyWalletMsg)
  if (!buyWalletMsg.ack) {
    console.log('getting buy wallet failed', buyWalletMsg)
    tgLog('*getting buy wallet failed*', buyWalletMsg)
    return false
  }

  const sellWallet = sellWalletMsg.wallet
  const buyWallet = buyWalletMsg.wallet

  console.log('input', buyPrice, sellPrice, size, buyExch, sellExch, pair, sellWallet, buyWallet)
  // sell loaned btc on bitf. price lock!
  console.log('shorting', size, 'of', 'pair', 'at', sellExch, 'at price', sellPrice)
  tgLog('*shorting*', size, 'of', 'pair', 'at', sellExch, 'at price', sellPrice)
  const sellOrder = await exec.short(sellExch, pair, sellPrice, size)
  if (!sellOrder.ack) {
    console.error('can\'t short', sellOrder)
    return false
  }
  // buy btc on btrx
  console.log('buying', size, 'of', pair, 'at', buyExch, 'at price', buyPrice)
  tgLog('*buying*', size, 'of', pair, 'at', buyExch, 'at price', buyPrice)
  const buyOrder = await exec.buy(buyExch, pair, buyPrice, size)
  if (!buyOrder.ack) {
    console.error('can\'t buy', buyOrder)
    tgLog('*can\'t buy*', buyOrder)
    return false
  }

  await sleep(10000)
  console.log('check remaining and cancel buy order', buyOrder)
  tgLog('*check remaining* and cancel buy order', buyOrder)
  const buyStatus = await getRemainsAndCancel(buyOrder)
  console.log('remaining: ', buyStatus)
  tgLog('*remaining*: ', buyStatus)
  if (!buyStatus.ack) {
    console.log('can\'t get but order status', buyStatus)
    tgLog('*can\'t get but order status*', buyStatus)
    return false
  }
  console.log('check remaining and cancel sell order', sellOrder)
  tgLog('*check remaining* and cancel sell order', sellOrder)
  const sellStatus = await getRemainsAndCancel(sellOrder)
  console.log('remaining:', sellStatus)
  tgLog('*remaining*:', sellStatus)
  if (!sellStatus.ack) {
    console.log('can\'t get but order status', sellStatus)
    tgLog('*can\'t get but order status*', sellStatus)
    return false
  }

  // transfer BTC from BTRX to BITF
  // todo: and wait for btc deposit at BITF
  console.log('transfering', size - buyStatus.remains, 'of', pair.counter, 'from', buyExch, 'to', sellExch, 'to wallet', buyWallet)
  tgLog('*transfering*', size - buyStatus.remains, 'of', pair.counter, 'from', buyExch, 'to', sellExch, 'to wallet', buyWallet)
  const transferStatus = await exec.transferFunds(buyExch, sellExch, size - buyStatus.remains, pair.counter, buyWallet)
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
  const usdtSize = size * buyPrice - sellStatus.remains
  console.log('backtransferring', usdtSize, 'of', pair.base, 'from', sellExch, 'to', buyExch, 'to wallet', sellWallet)
  tgLog('*backtransferring*', usdtSize, 'of', pair.base, 'from', sellExch, 'to', buyExch, 'to wallet', sellWallet)
  const backtransferStatsu = await exec.transferFunds(sellExch, buyExch, usdtSize, pair.base, sellWallet)
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
async function calc (book1, book2, exch1Name, exch2Name, pair) {
  if (execInProgress) {
    return
  }
  const myFunds = 1
  const buyDepth = adaptBook(book1, sides.ASK)
  const sellDepth = adaptBook(book2, sides.BID)
  const fees1 = fees.getFees(exch1Name)
  const fees2 = fees.getFees(exch2Name)

  if (buyDepth.length > 5 && sellDepth.length > 5) {
    const arbRes = calculate(buyDepth, sellDepth, fees1.taker, fees2.taker, fees1.withdrawal.BTC, fees2.withdrawal.USDT, myFunds)
    if (profitTreshold(arbRes)) {
      console.log(new Date())
      console.log(arbRes)

      execInProgress = true
      tgLog('DEMO MODE, syncExec is commented out')
      // tgLog(JSON.stringify(arbRes, null, 2))
      await sleep(10 * 1000)
      // const result = await syncExec(arbRes.arbBuy, arbRes.arbSell, arbRes.volume, exch1Name, exch2Name, pair, sellWallet, buyWallet)
      // TODO
      // await exec.cancelAllOrders()
      execInProgress = false
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
    console.log('Bittrex market data not ready')
    return
  }
  if (Date.now() - bittrexBooks.lastUpdated > 5000) {
    console.log('Bittrex market data outdated')
    reconnectBittrexWs(onBittrexBookUpdate)
    return
  }
  calc(bittrexBook, bitfinexBook, exchanges.BITTREX, exchanges.BITFINEX, pair).then()
}

const bittrexBooks = {}
function onBittrexBookUpdate(pair, data) {
  bittrexBooks.lastUpdated = Date.now()
  const bittrexBook = bittrexBooks[pair.display]
  bittrexBook.updateLevels(sides.ASK, data.sell.map(d => [d.Rate, d.Quantity]))

  bittrexBook.updateLevels(sides.BID, data.buy.map(d => [d.Rate, d.Quantity]))
  const bitfinexBook = bitfinexBooks[pair.display]
  if (!bitfinexBooks.lastUpdated) {
    console.log('Bitfinex market data not ready')
    return
  }
  if (Date.now() - bitfinexBooks.lastUpdated > 5000) {
    console.log('Bitfinex market data outdated')
    reconnectBitfinexWs(onBitfinexBookUpdate)
    return
  }
  calc(bittrexBook, bitfinexBook, exchanges.BITTREX, exchanges.BITFINEX, pair).then()
}

function parseConfig () {
  const [bitfKey, bitfSecret] = process.env.BITF.split(':')
  const [btrxKey, btrxSecret] = process.env.BTRX.split(':')
  let [tgToken, tgUsers] = process.env.TG.split('!')
  const pair = pairs[process.env.PAIR]
  assert(bitfKey && bitfSecret, 'env variable BITF should be API_KEY:API_SECRET')
  assert(btrxKey && btrxSecret, 'env variable BTRX should be API_KEY:API_SECRET')
  assert(tgToken && tgUsers, `env variable TG should be TELEGRAM_BOT_TOKEN!user_id1,user_id2`)
  assert(pair, `env variable PAIR should be a valid pair, got ${process.env.PAIR} instead. Valid pairs are ${Object.keys(pairs).join(', ')}`)
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
    pair,
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
          await tg.sendMessage(users[i], str, {parse_mode: 'Markdown'})
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

  pairsToSubscribe = _.pick(pairs, [process.env.PAIR])
  console.log(config)

  await createTg(config.tgToken, config.tgUsers)

  reconnectBitfinexWs()
  reconnectBittrexWs()

  exec.registerDriver(exchanges.BITTREX, bittrexDriver)
  exec.registerDriver(exchanges.BITFINEX, bitfinexDriver)
  const nonceGen = createNonceGenerator()
  bitfinexDriver.setKeys(config.BITF.key, config.BITF.secret, nonceGen)
  bittrexDriver.setKeys(config.BTRX.key, config.BTRX.secret)

  const {base, counter} = config.pair
  const btfBalanceBase = await bitfinexDriver.balance(base)
  checkAck(btfBalanceBase)
  const btfBalanceCounter = await bitfinexDriver.balance(counter)
  checkAck(btfBalanceCounter)
  const btxBalanceBase = await bittrexDriver.balance(base)
  checkAck(btxBalanceBase)
  const btxBalanceCounter = await bittrexDriver.balance(counter)
  checkAck(btxBalanceCounter)
  const msg = `Calc started. Balance:
  Bitfinex: ${btfBalanceBase.balance} ${base}, ${btfBalanceCounter.balance} ${counter},
  Bittrex: ${btxBalanceBase.balance} ${base}, ${btxBalanceCounter.balance} ${counter}`
  if (!await tgLog(msg)) {
    console.log('could not send reporting message')
    process.exit(1)
  }
}

function checkAck (resp) {
  if (!resp.ack) {
    console.log('No ack from driver:', resp)
    process.exit(1)
  }
}

if (require.main === module) {
  main().then()
} else {
  exports.syncExec = syncExec
}
