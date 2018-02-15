'use strict';

const TelegramBot = require('node-telegram-bot-api');

module.exports = new TelegramBot(
    'YOUR_TELEGRAM_ACCESS_TOKEN',
    {polling: true}
);
