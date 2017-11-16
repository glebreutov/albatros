const BitfinexApi = require('../src/BitfinexRest')
const {pairs, sides} = require('../src/const')
const {sleep, assert} = require('../src/tools')
const _ = require('lodash')
const now = require('performance-now')

const createNonceGenerator = require('../src/createNonceGenerator')

const nonceGen = createNonceGenerator()
const key = process.env.BITF.split(':')[0]
const secret = process.env.BITF.split(':')[1]

// main driver to test
const drv1 = require('../src/BitfinexDriver')
drv1.setKeys(key, secret, nonceGen)

// one more REST api instance to test
const restApi = new BitfinexApi(key, secret, nonceGen)

async function main () {
  let book = await restApi.getOrderBook(pairs.USDTBTC)
  const tooHighPrice = _.max(book.bids.map(order => parseFloat(order.price))) + 1000

  let acc = 0
  for (let i = 0; i < 10; i++) {
    const n = now()
    const orderP = drv1.newOrder(pairs.USDTBTC, tooHighPrice, 0.005, sides.SHORT)
    const promiseP = now() - n
    const order = await orderP
    const ping = now() - n
    acc += ping
    console.log(`bitf promise created in ${promiseP.toFixed(2)} ms, ping ${ping.toFixed(2)} ms, order is ${JSON.stringify(order)}`)
    await sleep(500)
    await drv1.cancel(order)
    await sleep(500)
  }

  console.log(`avg ping ${(acc / 10).toFixed(2)} ms`)

  await sleep(5000)
  const orders = await restApi.getActiveOrders()
  console.log(`${orders.length} remaining: ${JSON.stringify(orders)}`)
}

main().then()
