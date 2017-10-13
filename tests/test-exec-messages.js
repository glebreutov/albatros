function testAny(any){
  return 'ack' in any && typeof any.ack === 'boolean'
}

function testOrderStatus(os){
  return testAny(os) && 'id' in os && 'exch' in os && 'pair' in os
}

console.log(testAny({ack: 1}))