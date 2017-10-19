const exec = require('../src/Execution')
const syncExec = require('../run-calc').syncExec
const {pairs, sides} = require('../src/const')
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

exec.registerDriver('BTRX', bittrexDriver)
exec.registerDriver('BITF', bitfinexDriver)

const nonceGen = createNonceGenerator()
bitfinexDriver.setKeys(config.BITF.key, config.BITF.secret, nonceGen)
bittrexDriver.setKeys(config.BTRX.key, config.BTRX.secret)

syncExec(5710, 5699, 0.01, 'BTRX', 'BITF', pairs.USDTBTC, '1BhEFhyZSfjXyQE77NvV3bSVNG8JChKhio', '1AW9uvGn6nFPsaAkZNnRGXkSLJXGK62wPG').then()
