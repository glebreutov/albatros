const feeMap = {
  BITF: {
    taker: 0.002,
    maker: 0,
    withdrawal: {
      BTC: 0.0004,
      USDT: 2,
      ETH: 0.01
    }
  },
  BTRX: {
    taker: 0.0025,
    maker: 0,
    withdrawal: {
      BTC: 0.001,
      USDT: 5,
      ETH: 0.002
    }
  },
  PLNX: {
    taker: 0.0025,
    maker: 0,
    withdrawal: {
      BTC: 0.0001,
      USDT: 2
    }
  },
  EXMO: {
    taker: 0.002,
    maker: 0,
    withdrawal: {
      BTC: 0.001,
      USDT: 5
    }
  }

}

function getFees (exch) {
  const exchFee = feeMap[exch]
  if (exchFee) {
    return exchFee
  } else {
    throw new Error('no fees for exchange ' + exch)
  }
}

exports.getFees = getFees
