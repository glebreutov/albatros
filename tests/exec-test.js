const exec = require('../src/Execution')
const syncExec = require('../run-calc').syncExec
const {pairs, exchanges} = require('../src/const')
const bitfinexDriver = require('../src/BitfinexDriver')
const bittrexDriver = require('../src/BittrexDriver')
const createNonceGenerator = require('../src/createNonceGenerator')
const sleep = require('../src/tools').sleep

const config = {
  BITF: {
    key: process.env.BITF.split(':')[0],
    secret: process.env.BITF.split(':')[1],
    wallet: process.env.BITF.split(':')[2]
  },
  BTRX: {
    key: process.env.BTRX.split(':')[0],
    secret: process.env.BTRX.split(':')[1],
    wallet: process.env.BTRX.split(':')[2]
  },
  pair: pairs[process.env.PAIR]
}

exec.registerDriver(exchanges.BITTREX, bittrexDriver)
exec.registerDriver(exchanges.BITFINEX, bitfinexDriver)

const nonceGen = createNonceGenerator()
bitfinexDriver.setKeys(config.BITF.key, config.BITF.secret, nonceGen)
bittrexDriver.setKeys(config.BTRX.key, config.BTRX.secret)

// syncExec(5678, 5666, 0.005, 'BTRX', 'BITF', pairs.USDTBTC, '1BhEFhyZSfjXyQE77NvV3bSVNG8JChKhio', '1AW9uvGn6nFPsaAkZNnRGXkSLJXGK62wPG').then()
// wallets
// bitf btc margin 1BhEFhyZSfjXyQE77NvV3bSVNG8JChKhio
// btrx btc 18FjdmsHGBVDVpELEsXTRqtXD7K6rj4owt
async function sellOrder () {
  const resp = await exec.sell('BTRX', pairs.USDTBTC, 10000, 0.1)
  console.log(resp)
  const cancelStatus = await exec.cancel(resp)
  console.log(cancelStatus)
}

async function showWallets () {
  // const targetBalance = await exec.balance('BITF', 'ETH')
  // console.log(targetBalance)
  const arr = ['BTC', 'ETH', 'LTC', 'ETC', 'ZEC', 'DASH', 'OMG', 'BCH', 'NEO']
  for (let i in arr) {
    const e = arr[i]
    const walletBtrx = await exec.wallet('BTRX', e)
    console.log('BTRX', e, walletBtrx.wallet)
    const walletBitf = await exec.wallet('BITF', e)
    console.log('BITF', e, walletBitf.wallet)
    await sleep(500)
  }
  // console.log(wallet)
  // const transferStatus = await exec.transferFunds('BTRX', 'BITF', 2.1537663321524323, 'ETH', '0x3c8279d082e9d61bfc255d32153510796b063dad')
  // console.log(transferStatus)
}
// async function test () {
//   const newVar = await exec.closePositions('BITF')
//   console.log(newVar)
// }

// test().then()

// showWallets().then()

function outs (sellRemains, buyRemains) {
  if (sellRemains === 0 && buyRemains === 0) {
    // do nothing
  } else if (sellRemains === buyRemains) {
    // cancel buy
    // cancel sell
  } else if (sellRemains > buyRemains) {
    // cancel buy order
    // buy back sellRemains
  } else if (sellRemains < buyRemains) {
    // cancell sellOrder
    // sell buyRemains
  }
}
sellOrder().then()
