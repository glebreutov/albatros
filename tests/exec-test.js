const exec = require('../src/Execution')
const syncExec = require('../run-calc').syncExec
const {pairs, exchanges} = require('../src/const')
const bitfinexDriver = require('../src/BitfinexDriver')
const bittrexDriver = require('../src/BittrexDriver')
const createNonceGenerator = require('../src/createNonceGenerator')

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



async function moveMoney () {
  // const targetBalance = await exec.balance('BITF', 'ETH')
  // console.log(targetBalance)
  // const wallet = await exec.wallet('BITF', 'ETH')
  // console.log(wallet)
  // const transferStatus = await exec.transferFunds('BTRX', 'BITF', 2.1537663321524323, 'ETH', '0x3c8279d082e9d61bfc255d32153510796b063dad')
  console.log(transferStatus)
}
// async function test () {
//   const newVar = await exec.closePositions('BITF')
//   console.log(newVar)
// }

// test().then()

moveMoney().then()
