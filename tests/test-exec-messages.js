function testAny (any) {
  return 'ack' in any && typeof any.ack === 'boolean'
}

function testOrderStatus (os) {
  return testAny(os) && 'id' in os && 'exch' in os && 'pair' in os
}

function testOrderStatus (os) {
  return testAny(os) && 'remains' in os && typeof os.remains === 'number'
}

console.log(testAny({ack: true}))
console.log(testOrderStatus({ remains: 0.01,
  resp:
    { ack: true,
      payload: { success: true, message: '', result: [Object] } },
  ack: true }))
