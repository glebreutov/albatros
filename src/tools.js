exports.chain = function chain (obj, methodNames) {
  return methodNames.reduce((acc, curr) => {
    acc[curr] = (...args) => { obj[curr](...args); return acc }
    return acc
  }, {value: () => obj})
}

exports.bind = function bind (names, context) {
  names.forEach(fn => { context[fn] = context[fn].bind(context) })
}
