const exec = require('../src/Execution')
const syncExec = require('../run-calc').syncExec
const {pairs, exchanges} = require('../src/const')
const bitfinexDriver = require('../src/BitfinexDriver')
const bittrexDriver = require('../src/BittrexDriver')
const createNonceGenerator = require('../src/createNonceGenerator')
const config = {
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
  const forw = await exec.transferFunds('BITF', 'BTRX', '0.01', 'BTC', '1BhEFhyZSfjXyQE77NvV3bSVNG8JChKhio')
  console.log(forw)
  const backw = await exec.transferFunds('BTRX', 'BITF', '0.01', 'BTC', '18FjdmsHGBVDVpELEsXTRqtXD7K6rj4owt')
  console.log(backw)
}
async function test () {
  const newVar = await exec.closePositions('BITF')
  console.log(newVar)
}

// test().then()

moveMoney().then()
