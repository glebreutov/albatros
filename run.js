const BitfinexAdapter = require('./src/bitfinex')

async function start () {
  await testSubscribeImmediately()
  await testConnectCompleteThenSubscribe()
  await testSubscribeDuringReconnect()
  console.log('waiting few seconds to find out any unterminated stuff')
  await justWait(2000)
  console.log('done')
}

function resolveIfMsgOk (resolve, bitFinexAdapter) {
  return msg => {
    if (msg['event'] === 'subscribed' && msg['channel'] === 'book' && msg['pair'] === 'BTCUSD') {
      console.log('received subscription confirmation, test passed')
      bitFinexAdapter.destroy()
      resolve()
    }
  }
}
async function testSubscribeImmediately () {
  return new Promise(resolve => {
    const btf = new BitfinexAdapter()
    btf.subscribeBook('BTC-USD')
    btf.on('wsMessage', resolveIfMsgOk(resolve, btf))
  })
}

async function testConnectCompleteThenSubscribe () {
  return new Promise(resolve => {
    const btf = new BitfinexAdapter()
    btf.on('wsOpen', () => btf.subscribeBook('BTC-USD'))
    btf.on('wsMessage', resolveIfMsgOk(resolve, btf))
  })
}

async function testSubscribeDuringReconnect () {
  return new Promise(resolve => {
    const btf = new BitfinexAdapter()
    let openedOnce = false
    btf.on('wsOpen', () => {
      if (!openedOnce) {
        openedOnce = true
        btf.forceCloseWs()
        btf.subscribeBook('BTC-USD')
      }
    })
    btf.on('wsMessage', resolveIfMsgOk(resolve, btf))
  })
}

async function justWait (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

start().then()
