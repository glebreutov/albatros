const Decimal = require('decimal.js')

function calcBookAmount2 (v, money) {
  const start = {moneyRemains: money, size: 0}
  const accumFx = (acc, v) => {
    if (acc.moneyRemains > 0) {
      const levelCost = v.size * v.price
      if (acc.moneyRemains - levelCost >= 0) {
        acc.size += v.size
        acc.moneyRemains -= levelCost
      } else {
        acc.size += acc.moneyRemains / v.price
        acc.moneyRemains = 0
      }
    }
    return acc
  }
  return v.reduce(accumFx, start)
}
function val (buy, sell) {
  const mid = Math.abs(buy + sell) / 2
  const raw = 100 * (sell - buy) / mid
  return Math.round(raw * 100) / 100
}

function calcSellSize (depth, maxSize) {
  const sum = depth.map(x => x.size).reduce((a, v) => a + v, 0)
  return Math.min(sum, maxSize)
}

function calcBuySize (depth, amount) {
  return calcBookAmount2(depth, amount).size
}

function calcAmount (depth, size, amount = 0) {
  if (size < 0) {
    // console.log('function has bug, size cannot be less than zero', size)
    return 0
  }
  if (depth.length === 0 || size === 0) {
    return amount
  }
  const firstElement = depth[0]
  if (size >= firstElement.size) {
    const newSize = size - firstElement.size
    const newAmount = amount + firstElement.price * firstElement.size
    return calcAmount(depth.slice(1), newSize, newAmount)
  } else {
    return amount + firstElement.price * size
  }
}

function log (message) {
  // console.log(message)
}
const PRECISION = 3
function calculate (buyDepth, sellDepth, buyFee, sellFee,
                    buyWithdrawal, sellWithdrawal, buyBalance, pair) {
  // calculating profitable diff
  const profitableSellDepth = sellDepth
        .filter(s => buyDepth.filter(b => b.price < s.price).length > 0)

  const profitableBuyDepth = buyDepth
        .filter(b => sellDepth.filter(s => s.price > b.price).length > 0)

  log(`buy balance: ${buyBalance} ${pair.base}`)
  log(`buy fee: ${buyFee}%`)
  log(`sell fee: ${sellFee}%`)
  log(`${pair.counter} fee: ${buyWithdrawal}`)
  log(`${pair.base} fee: ${sellWithdrawal}`)

  log(`profitable buy depth ${profitableBuyDepth.size}`)
  log(`profitable sell depth ${profitableSellDepth.size}`)
  // calculating amount to buy
  // returns volume tht can be bought
  const buySize = calcBuySize(profitableBuyDepth, buyBalance)
  log(`available amount to buy ${buySize}`)
  // calculating how much we able to sell
  const sellSize = calcSellSize(profitableSellDepth, buySize)
  log(`available amount to sell ${sellSize}`)
  // getting deal size
  const orderVol = Math.min(buySize, sellSize)

  const buyPrice = profitableBuyDepth.map(x => x.price).reduce((acc, val) => Math.min(acc, val), Number.MAX_SAFE_INTEGER)
  // log(`limit buy ${buyPrice}`)
  const sellPrice = profitableSellDepth.map(x => x.price).reduce((acc, val) => Math.max(acc, val), 0)
  // log(`limit short ${sellPrice}`)

  const buyVol = orderSize(orderVol, pair, buyWithdrawal)
  const shortVol = parseFloat((buyVol - buyWithdrawal).toFixed(PRECISION))
  // console.log('order vol', orderVol)
  // console.log('buy vol', buyVol)
  // console.log('short vol', shortVol)
  const shortAmt = calcAmount(profitableSellDepth, shortVol)
  const buyAmt = calcAmount(profitableBuyDepth, buyVol)
  // console.log('buy amt', buyAmt)
  const profit = shortAmt * (1 - sellFee) - buyAmt * (1 + buyFee) - sellWithdrawal
  // console.log('short amt', shortAmt)
  const perc = (profit / (shortAmt / 100)).toFixed(4)
  return {
    profit: parseFloat(profit.toFixed(5)),
    rawProfit: shortAmt - buyAmt,
    // profitDescribe: `${shortAmt} * (1 - ${sellFee}) - ${buyAmt} * (1 + ${buyFee}) - ${buyWithdrawal} * ${buyPrice} - ${sellWithdrawal}`,
    sellAmt: shortAmt * (1 - sellFee),
    buyAmt: buyAmt * (1 + buyFee),
    // volume: orderVol,
    buySize: buyVol,
    shortSize: shortVol,
    perc: perc,
    spread: sellPrice - buyPrice,
    buy: buyPrice,
    sell: sellPrice,
    arbBuy: profitableBuyDepth.map(x => x.price).reduce((acc, val) => Math.max(acc, val), 0),
    arbSell: profitableSellDepth.map(x => x.price).reduce((acc, val) => Math.min(acc, val), Number.MAX_SAFE_INTEGER)
  }
}

exports.verifyArbResults = (arb) => {
  return checkSaneNumber(arb.arbBuy) &&
    checkSaneNumber(arb.arbSell) &&
    checkSaneNumber(arb.buy) &&
    checkSaneNumber(arb.sell) &&
    checkSize(arb.buySize) &&
    checkSize(arb.shortSize) &&
    checkAmount(arb.buyAmt) &&
    checkAmount(arb.sellAmt)
}

function checkSaneNumber (price) {
  return typeof price === 'number' &&
    !isNaN(price) &&
    price > 0 &&
    price < Number.MAX_SAFE_INTEGER
}

function checkSize (size, currency) {
  const saneNumber = checkSaneNumber(size)
  const btcSize = size >= 0.01 && (['BTC', 'ZEC'].includes(currency))
  const othersSize = size >= 0.1 && !['BTC', 'ZEC'].includes(currency)
  return saneNumber && (btcSize || othersSize)
}

function checkAmount (amnt) {
  return checkSaneNumber(amnt) && amnt >= 0.0005
}

function orderSize (size, pair, withdrawalFee) {
  if (pair.counter === 'NEO') {
    const newSizeUp = parseFloat(size.toFixed(0)) + withdrawalFee
    const newSizeDown = parseFloat(size.toFixed(0)) + withdrawalFee - 1
    if (newSizeUp <= size) {
      return newSizeUp
    } else if (newSizeDown > withdrawalFee) {
      return newSizeDown
    } else {
      return 0
    }
  } else {
    return parseFloat(size.toFixed(PRECISION))
  }
}
exports.calculate = calculate

function testValue () {
  return [{size: 1, price: 100},
    {size: 0.5, price: 99.1},
    {size: 3, price: 99},
    {size: 0.001, price: 98.9},
    {size: 2.1, price: 98.8}]
}

// console.log('test with zero size', calcAmount(testValue(), 0))
// console.log('test with first level only', calcAmount(testValue(), 1))
// console.log('test with few levels', calcAmount(testValue(), 2), 'manual check ', 100 * 1 + 0.5 * 99.1 + 0.5 * 99)
// console.log('test with overflow', calcAmount(testValue(), 100), 'manual check ', 100 * 1 + 0.5 * 99.1 + 3 * 99 + 0.001 * 98.9 + 2.1 * 98.8)
