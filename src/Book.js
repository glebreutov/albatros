const Big = require('big.js/big')
const { OrderedMap, Map } = require('immutable')
const { mapDeep, assert } = require('./tools')
const { sides } = require('./const')

/**
 * 0 - price (base currency)
 * 1 - size (quote currency)
 * @typedef {Big[]} Level
 */

class Book {
  constructor () {
    this.levels = Map()
      .set(Book.SIDE_BID, OrderedMap())
      .set(Book.SIDE_ASK, OrderedMap())
  }

  /**
   * best price comes first, numbers are Big from big.js
   * @param side
   * @return {Level[]}
   */
  getLevels (side) {
    Book.assertSide(side)
    return this.levels.get(side).entrySeq().toJS()
  }

  updateLevels (side, levels) {
    Book.assertSide(side)
    assert(Array.isArray(levels), 'ArgumentException: levels')

    this.levels = this.levels.updateIn([side], currentLevels =>
      currentLevels
        .merge(Map(mapDeep(levels, (l) => (l instanceof Big) ? l : Big(l))))
        .filterNot(v => v.eq(0))
        .sortBy((v, k) => k, Book.priceComparators[side])
    )
  }

  _incrementLevel (side, price, size) {
    const levelSize = this.levels.getIn([side, price])
    if (!levelSize && size.lte(0)) {
      console.error(`incrementLevel ${price}/${size} failed: level not found`)
      return
    }
    let newSize = levelSize.plus(size)
    if (newSize.lt(0)) {
      console.warn(`incrementLevel ${price}/${size} warning: decremented too much`)
      newSize = Big(0)
    }
    this._setLevelSize(side, price, newSize)
  }

  incrementLevel (side, price, size) {
    Book.assertSide(side)
    this._incrementLevel(side, Big(price), Big(size))
  }

  /**
   * Shows the amount of base currency that will be needed so targetPrice is the best price.
   * A newcoming order is considered to be the last one to execute, so existing prices
   * are "better" than targetPrice even if they are equal.
   * @param side
   * @param targetPrice
   * @return {Big} base currency amount or 0, if the book was empty
   */
  getDistance (side, targetPrice) {
    Book.assertSide(side)
    assert(targetPrice > 0, 'ArgumentException: targetPrice')

    targetPrice = Big(targetPrice)
    let distance = Big(0)
    // default reduce() does not support breaks
    this.levels.get(side).forEach((size, levelPrice) => {
      if (Book.priceIsBetter(side, targetPrice, levelPrice)) {
        // break
        return false
      }
      distance = distance.plus(size.times(levelPrice))
    })
    return distance
  }

  /**
   *
   * @param side
   * @param amount
   * @return {Big|undefined} price or undefined, if the book was empty
   */
  getPriceAtDistance (side, amount) {
    Book.assertSide(side)
    assert(amount > 0, 'ArgumentException: amount')

    amount = Big(amount)
    let price
    this.levels.get(side).forEach((size, levelPrice) => {
      price = levelPrice
      amount = amount.minus(size.times(price))
      if (amount.lt(0)) {
        // break
        return false
      }
    })
    return price
  }

  /**
   *
   * @param side
   * @param referencePrice
   * @return {Level}
   */
  getNextBetterLevel (side, referencePrice) {
    Book.assertSide(side)
    referencePrice = Big(referencePrice)

    return this.levels.get(side)
      .findLastEntry((size, levelPrice) => Book.priceIsBetter(side, levelPrice, referencePrice))
  }

  /**
   *
   * @param side
   * @param referencePrice
   * @return {Level}
   */
  getNextWorseLevel (side, referencePrice) {
    Book.assertSide(side)
    referencePrice = Big(referencePrice)

    return this.levels.get(side)
      .findEntry((size, levelPrice) => Book.priceIsBetter(side, referencePrice, levelPrice))
  }
}
Book.SIDE_BID = sides.BID
Book.SIDE_ASK = sides.ASK
Book.INDEX_PRICE = 0
Book.INDEX_SIZE = 1

Book.priceComparators = {
  [Book.SIDE_ASK]: (a, b) => a.cmp(b),
  [Book.SIDE_BID]: (a, b) => b.cmp(a)
}
Book.priceIsBetter = function priceIsBetter (side, candidate, reference) {
  return Book.priceComparators[side](candidate, reference) < 0
}

Book.assertSide = function assertSide (side) {
  assert(side === Book.SIDE_BID || side === Book.SIDE_ASK, 'ArgumentException: side')
}

module.exports = Book
