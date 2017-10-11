const BitfinexApi = require('../src/BitfinexRest')
const debug = require('debug')('Test:BitfinexDriver')
const {pairs, sides} = require('../src/const')
const {sleep, assert} = require('../src/tools')
const _ = require('lodash')

const createNonceGenerator = require('../src/createNonceGenerator')

const nonceGen = createNonceGenerator()
const key = process.env.BITFINEX_API_KEY
const secret = process.env.BITFINEX_API_SECRET

// main driver to test
const drv1 = require('../src/BitfinexDriver')
drv1.setKeys(key, secret, nonceGen)

// one more REST api instance to test
const restApi = new BitfinexApi(key, secret, nonceGen)

async function start () {
  debug('Starting test')

  let orders = await restApi.getActiveOrders()
  assert(orders.length === 0, 'There should be no orders at this point. WARNING: all orders will be cancelled now')

  const wallet = _.find(await restApi.getWallets(), {'type': 'exchange', 'currency': 'btc'})
  const availableBtc = wallet && parseFloat(wallet['available'])
  assert(availableBtc > 0.005, 'Not enough btc to run tests')
  assert(availableBtc < 200, 'Too many btc to run tests :)')

  let book = await restApi.getOrderBook(pairs.USDTBTC)
  const tooHighPrice = _.max(book.bids.map(order => parseFloat(order.price))) + 1000

  debug('Next test should fail due to low btc balance')
  let order = await drv1.newOrder(pairs.USDTBTC, tooHighPrice, 200, sides.ASK)
  assert(order, 'newOrder() should return an order even when failed')
  assert(!order.ack, 'newOrder() sell 200 btc should fail')

  debug('Next test should place an order with a price too high to execute')
  order = await drv1.newOrder(pairs.USDTBTC, tooHighPrice, 0.005, sides.ASK)
  assert(order.ack && order.id, `newOrder() should place an order of 0.005 btc at ${tooHighPrice} usd`)
  orders = await restApi.getActiveOrders()
  assert(orders.length, `newOrder() should place an order of 0.005 btc at ${tooHighPrice} usd`)

  debug('Next test should wait 2 seconds for order to execute and continue with live order')
  const r1 = await drv1.waitForExec(order, sleep(2000, false))
  assert(r1 === false, 'waitForExec() should unlock with sleep() resolved value as the price was too high to execute the order in 2s')

  debug('Next test should cancel an order')
  await drv1.cancel(order)
  orders = await restApi.getActiveOrders()
  assert(orders.length === 0, 'There should be no orders at this point')
  return true
}

Promise.race([start(), sleep(50 * 1000, false)]).then(result => {
  if (!result) {
    debug('Test timed out')
    tearDown(1)
  } else {
    debug('SUCCESS')
    tearDown(0)
  }
}, err => {
  debug('Test failed:')
  debug(err)
  tearDown(2)
})

function tearDown (exitCode) {
  (async function t () {
    try {
      debug('Teardown')
      const orders = await restApi.getActiveOrders()
      debug(`found ${orders.length} orders`)
      let c = 0
      for (const order of orders) {
        await restApi.cancelOrder(order.id)
        await sleep(200)
        c += 1
      }
      debug(`${c} orders cancelled`)
    } catch (e) {
      debug('Teardown failed:')
      debug(e)
    }
  }()).then(() => process.exit(exitCode))
}
