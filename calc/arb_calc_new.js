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
  return v.reduce((acc, v) => {
    if (acc.moneyRemains > 0) {
      const levelCost = v.size * v.price
      if (acc.moneyRemains - levelCost >= 0) {
        acc.size += v.size
        acc.moneyRemains -= levelCost
      } else {
        acc.size += v.price / acc.moneyRemains
        acc.moneyRemains = 0
      }
    }
    return acc
  }, {moneyRemains: money, size: 0})
}
function val (buy, sell) {
  const mid = Math.abs(buy + sell) / 2
  const raw = 100 * (sell - buy) / mid
  return Math.round(raw * 100) / 100
}

function calculate (buyDepth, sellDepth, buyFee, sellFee,
                    buyWithdrawal, sellWithdrawal, buyBalance, sellBalance) {
  const profitableSellDepth = sellDepth
        .filter(s => buyDepth.filter(b => b.price < s.price).length > 0)

  const profitableBuyDepth = buyDepth
        .filter(b => sellDepth.filter(s => s.price > b.price).length > 0)

  const arb1 = calcBookAmount2(profitableBuyDepth, buyBalance)
  const arb2 = calcBookAmount2(profitableBuyDepth, sellBalance)

  const orderVol = Math.min(arb1.size, arb2.size)

  const buyAmt = calcBookAmount(profitableBuyDepth, orderVol).amount
  const sellAmt = calcBookAmount(profitableSellDepth, orderVol).amount

  const buyPrice = profitableBuyDepth.length > 0 ? profitableBuyDepth[0].price : 0
  const sellPrice = profitableSellDepth.length > 0 ? profitableSellDepth[0].price : 0

  const perc = val(buyDepth[0].price, sellDepth[0].price)
  return {
    profit: sellAmt * (1 - sellFee) - buyAmt * (1 + buyFee) - buyWithdrawal * buyPrice - sellWithdrawal,
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
