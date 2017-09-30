const _ = require('lodash')

exports.chain = function chain (obj, methodNames) {
  return methodNames.reduce((acc, curr) => {
    acc[curr] = (...args) => { obj[curr](...args); return acc }
    return acc
  }, {value: () => obj})
}

exports.bind = function bind (names, context) {
  names.forEach(fn => { context[fn] = context[fn].bind(context) })
}

/**
 *
 * @param {{normal: any, specific: any}}[] arr
 * @return {denormalize: (function(*)), normalize: (function(*=))}
 */
exports.createConverter = function createConverter (arr) {
  const createFinder = (findKey, getKey) => val => {
    const found = _.find(arr, {[findKey]: val})
    if (!found) {
      throw new Error(`Value ${val} can't be ${findKey === 'normal' ? 'specified' : 'normalized'}`)
    }
    return found[getKey]
  }
  return {
    denormalize: createFinder('normal', 'specific'),
    normalize: createFinder('specific', 'normal')
  }
}

exports.mapDeep = function mapDeep (items, cb) {
  return Array.isArray(items) ? items.map(function (item) { return mapDeep(item, cb) }) : cb(items)
}

exports.assert = function assert (condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}
