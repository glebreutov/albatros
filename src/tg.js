const TelegramBot = require('node-telegram-bot-api')

let bot = null
function getBot () {
  if (!bot) {
    throw new Error('TG bot not initialized')
  }
  return bot
}

async function connect (telegramBotToken) {
  bot = new TelegramBot(telegramBotToken, {polling: true})
  console.log('Telegram API initialized')
  return bot
}

async function sendErrorLog (userIds, msg) {
  if (bot && userIds.length) {
    userIds.forEach(userId => sendMessage(userId, `*${msg}*`, {parse_mode: 'markdown'}))
  }
}

async function sendMessage (...args) {
  return getBot().sendMessage(...args)
}

module.exports = {
  getBot,
  connect,
  sendMessage,
  sendErrorLog
}
