module.exports = {
  // normalized pairs: BASE-QUOTE
  //BTC, LTC, ETH, ETC, ZEC, XMR, DSH, XRP, OMG, BCH, NEO
  pairs: {
    USDTBTC: {base: 'USDT', counter: 'BTC', display: 'USDT-BTC'},
    USDTLTC: {base: 'USDT', counter: 'LTC', display: 'USDT-LTC'},
    USDTETH: {base: 'USDT', counter: 'ETH', display: 'USDT-ETH'},
    USDTETC: {base: 'USDT', counter: 'ETC', display: 'USDT-ETC'},
    USDTZEC: {base: 'USDT', counter: 'ZEC', display: 'USDT-ZEC'},
    USDTXMR: {base: 'USDT', counter: 'XMR', display: 'USDT-XMR'},
    USDTDSH: {base: 'USDT', counter: 'DSH', display: 'USDT-DSH'},
    USDTXRP: {base: 'USDT', counter: 'XRP', display: 'USDT-XRP'},
    USDTOMG: {base: 'USDT', counter: 'OMG', display: 'USDT-OMG'},
    USDTBCH: {base: 'USDT', counter: 'BCH', display: 'USDT-BCH'},
    USDTNEO: {base: 'USDT', counter: 'NEO', display: 'USDT-NEO'}

  },
  sides: {
    ASK: 'ask',
    BID: 'bid'
  },
  position: {
    SHORT: 'SHORT', LONG: 'LONG'
  }
}
