module.exports = function createGenerator () {
  let nonce = Date.now()
  let locker = Promise.resolve()
  let currentRelease = () => {}
  return {
    async lock () {
      const currentLock = locker
      let rslv
      locker = new Promise(resolve => { rslv = resolve })
      await currentLock
      currentRelease = rslv
      return ++nonce
    },
    release () {
      currentRelease()
    }
  }
}
