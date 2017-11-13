function calcBookAmount (v, dealVolume) {
  return v.reduce((acc, v) => {
    if (acc.takenVolume <= dealVolume) {
      let size = v.size
      if (acc.takenVolume + v.size > dealVolume) {
        size = dealVolume - acc.takenVolume
      }
      acc.takenVolume += size
      acc.amount += (size * v.price)
    }
    return acc
  }, {takenVolume: 0, amount: 0})
}
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

function log (message) {
  // console.log(message)
}

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

  // just getting worse prices from all prices to match all volume
  const buyPrice = profitableBuyDepth.map(x => x.price).reduce((acc, val) => Math.min(acc, val), Number.MAX_SAFE_INTEGER)
  log(`limit buy ${buyPrice}`)
  const sellPrice = profitableSellDepth.map(x => x.price).reduce((acc, val) => Math.max(acc, val), 0)
  log(`limit short ${sellPrice}`)
  const sellAmt = sellPrice * orderVol
  const buyAmt = buyPrice * orderVol

  const perc = val(buyDepth[0].price, sellDepth[0].price)
  return {
    profit: sellAmt * (1 - sellFee) - buyAmt * (1 + buyFee) - buyWithdrawal * buyPrice - sellWithdrawal,
    rawProfit: sellAmt - buyAmt,
    profitDescribe: `${sellAmt} * (1 - ${sellFee}) - ${buyAmt} * (1 + ${buyFee}) - ${buyWithdrawal} * ${buyPrice} - ${sellWithdrawal}`,
    sellAmt: sellAmt * (1 - sellFee),
    buyAmt: buyAmt * (1 + buyFee),
    volume: orderVol,
    perc: perc,
    spread: sellPrice - buyPrice,
    buy: buyPrice,
    sell: sellPrice,
    arbBuy: profitableBuyDepth.map(x => x.price).reduce((a, c) => (!isNaN(a) && a < c) ? a : c, NaN),
    arbSell: profitableSellDepth.map(x => x.price).reduce((a, c) => (!isNaN(a) && a > c) ? a : c, NaN)
  }
}

exports.calculate = calculate
