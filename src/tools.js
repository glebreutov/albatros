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
 * @param dict [normalizedValue]: specificValue
 * @return {{denormalize: (function(*)), normalize: (function(*=))}}
 */
exports.createConverter = function createConverter (dict) {
  return {
    denormalize: normalizedValue => {
      const specificValue = dict[normalizedValue]
      if (!specificValue) {
        throw new Error(`Value ${normalizedValue} can't be denormalized`)
      }
      return specificValue
    },
    normalize: specificValue => {
      const normalizedValue = _.findKey(dict, v => v === specificValue)
      if (!specificValue) {
        throw new Error(`Value ${specificValue} can't be normalized`)
      }
      return normalizedValue
    }

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
