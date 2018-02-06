const feeMap = {
  BITF: {
    taker: 0.004,
    maker: 0,
    withdrawal: {
      BTC: 0.0008,
      USDT: 2,
      ETH: 0.0027,
      LTC: 0.001,
      ETC: 0.01,
      ZEC: 0.001,
      DASH: 0.01,
      //IOTA: 0,
      // EOS: 0.1,
      // SAN: 0.1,
      OMG: 0.1,
      BCH: 0.0005,
      NEO: 0,
      //ETP: 0.01,
      EDO: 0.5,
      // QTUM: 0.01,
      // AVT: 0.5,
      // DATA: 1
    }
  },
  BTRX: {
    taker: 0.0025,
    maker: 0,
    withdrawal: {
      BTC: 0.001,
      USDT: 5,
      ETH: 0.006,
      LTC: 0.01,
      ETC: 0.01,
      ZEC: 0.005,
      DASH: 0.002,
      OMG: 0.35,
      BCH: 0.001,
      NEO: 0.025,

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
