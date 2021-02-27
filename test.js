require('dotenv').config();
const MediaWikiJS = require('@sidemen19/mediawiki.js');
const bot = new MediaWikiJS({
  server: 'https://caburum.fandom.com',
  path: ''
});

(async () => {
  bot.login(process.env.botUsername, process.env.botPassword)
})();