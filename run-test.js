const BitfinexApi = require('./src/Bitfinex')
const {pairs} = require('./src/const')
const debug = require('debug')('main-test')

async function start () {
  await testSubscribeImmediately()
  await testConnectCompleteThenSubscribeEventually()
  await testSubscribeDuringReconnect()
  debug('waiting few seconds to find out any unterminated stuff')
  await justWait(2000)
  debug('done')
}

function resolveIfMsgOk (resolve, bitFinexAdapter) {
  return (pair, data) => {
    if (pair === pairs.USDTBTC && data.length === 3) {
      debug('received book subscription data, test passed')
      bitFinexAdapter.destroy()
      resolve()
    }
  }
}
async function testSubscribeImmediately () {
  return new Promise(resolve => {
    const btf = new BitfinexApi()
    btf.subscribeBook(pairs.USDTBTC)
    btf.once('bookUpdate', resolveIfMsgOk(resolve, btf))
  })
}

async function testConnectCompleteThenSubscribeEventually () {
  return new Promise(resolve => {
    const btf = new BitfinexApi()
    btf.once('bookUpdate', resolveIfMsgOk(resolve, btf))
    btf.on('sockedOpened', () => setTimeout(() => btf.subscribeBook(pairs.USDTBTC), 1500))
  })
}

async function testSubscribeDuringReconnect () {
  return new Promise(resolve => {
    const btf = new BitfinexApi()
    btf.once('bookUpdate', resolveIfMsgOk(resolve, btf))
    let openedOnce = false
    btf.on('sockedOpened', () => {
      if (!openedOnce) {
        openedOnce = true
        setImmediate(() => {
          btf.forceCloseWs()
          btf.subscribeBook(pairs.USDTBTC)
        })
      }
    })
  })
}

async function justWait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

start().then()
