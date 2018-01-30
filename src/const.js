module.exports = {
  // normalized pairs: BASE-QUOTE
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
    USDTNEO: {base: 'USDT', counter: 'NEO', display: 'USDT-NEO'},

    BTCETH: {base: 'BTC', counter: 'ETH', display: 'BTC-ETH'},
    BTCLTC: {base: 'BTC', counter: 'LTC', display: 'BTC-LTC'},
    BTCETC: {base: 'BTC', counter: 'ETC', display: 'BTC-ETC'},
    BTCZEC: {base: 'BTC', counter: 'ZEC', display: 'BTC-ZEC'},
    BTCDASH: {base: 'BTC', counter: 'DASH', display: 'BTC-DASH'},
    BTCOMG: {base: 'BTC', counter: 'OMG', display: 'BTC-OMG'},
    BTCBCH: {base: 'BTC', counter: 'BCH', display: 'BTC-BCH'},
    BTCNEO: {base: 'BTC', counter: 'NEO', display: 'BTC-NEO'},
    BTCIOTA: {base: 'BTC', counter: 'IOTA', display: 'BTC-IOTA'},
    BTCXRP: {base: 'BTC', counter: 'XRP', display: 'BTC-XRP'},
    BTCXMR: {base: 'BTC', counter: 'XMR', display: 'BTC-XMR'}
  },
  exchanges: {
    BITFINEX: 'BITF',
    BITTREX: 'BTRX'
  },
  sides: {
    ASK: 'ask',
    BID: 'bid',
    LONG: 'long',
    SHORT: 'short'
  },
  position: {
    SHORT: 'SHORT', LONG: 'LONG'
  }
}
