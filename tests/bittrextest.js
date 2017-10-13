const exec = require('../src/Execution')
const btrxDriver = require('../src/BittrexDriver')
const pairs = require('../src/const').pairs
btrxDriver.init('6fcaa371b3964427b214852323518634', '54138e62efca4c1790ab9c0bff2c196a')
exec.registerDriver('BTRX', btrxDriver)

async function placeAndCancelOrder () {
  const order = await exec.sell('BTRX', pairs.USDTBTC, 7000, 0.01)
  console.log(order)
  // const executionStatus = await exec.waitForExec(order)
  // console.log(executionStatus)
  const status = await exec.cancel(order)
  console.log(status)
}

async function withdraw () {
  const status = await exec.withdraw('BTRX', 'BTC', '1BhEFhyZSfjXyQE77NvV3bSVNG8JChKhio')
  console.log(status)
}



withdraw().then()
//placeAndCancelOrder().then()
