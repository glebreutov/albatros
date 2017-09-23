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
 * @param dict [UniformPair]: SpecificPair
 * @return {{fromUniformPair: (function(*)), toUniformPair: (function(*=))}}
 */
exports.createConverter = function (dict) {
  return {
    fromUniformPair: uniform => {
      const specificPair = dict[uniform]
      if (!specificPair) {
        throw new Error(`Pair ${uniform} not supported`)
      }
      return specificPair
    },
    toUniformPair: specificPair => {
      const uniform = _.findKey(dict, v => v === specificPair)
      if (!specificPair) {
        throw new Error(`Could not convert ${specificPair} to uniform pair`)
      }
      return uniform
    }

  }
}
