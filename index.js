const Discord = require('discord.js');
const client = new Discord.Client();

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const config = require('./config.json')
const help = require('./help.json')

const server = 'https://' + config.wiki + '.fandom.com';

const { MediaWikiJS } = require('@lavgup/mediawiki.js');
const bot = new MediaWikiJS({
  url: server + '/api.php'
});

async function get(params, callback) {
  https.get(`https://${bot.url}?format=json&` + params, (resp) => {
    let data = '';

    // A chunk of data has been recieved.
    resp.on('data', (chunk) => {
      data += chunk;
    });

    // The whole response has been received. Print out the result.
    resp.on('end', () => {
      callback(data);
    });
  }).on('error', (err) => {
    console.log('Error: ' + err.message);
  })
}

function argument(name, content) {
  var match = new RegExp('-' + name + ' (?:")((.*?))(?:")', 'ig');
  var matched = content.match(match);
  return matched[0].slice(name.length + 3, -1);
}

client.on('ready', async () => {
  console.log(`Logged in to Discord as ${client.user.tag}`);
  await bot.login(process.env.botUsername, process.env.botPassword);
  console.log(`Logged in to ${bot.api.options.url} as ${bot.api.options.botUsername}`);
});

client.on('message', async message => {
  if (message.content.indexOf(config.prefix) !== 0) return;
  if (message.author.id !== config.owner) {return;}

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  // Convert arguments to commonly used formats
  var spaced = args.join(' ');
  var underscored = args.join('_');

  // Split by line
  var lines = message.content.slice(config.prefix.length).trim().split(/\n+/g);

  // Normal args array but arguments in quotations are in one element of the array
  var quoted = spaced.match(/\w+|"[^"]+"/g)
  if (quoted) {var i = quoted.length};
  while(i--){
    quoted[i] = quoted[i].replace(/"/g,"");
  }

  switch (command) {
    case 'ping': {
      const ping = await message.channel.send('Ping?');
      ping.edit(`Pong! Bot latency is ${ping.createdTimestamp - message.createdTimestamp}ms. API Latency is ${Math.round(client.ws.ping)}ms.`);
      break;
    }

    case 'backlink': {
      /*
      * @todo Split message if too large
      */
      get('action=query&list=backlinks&bllimit=500&blnamespace=*&bltitle=' + underscored, function(data) {
        var res = JSON.parse(data);
        var backlinks = res.query.backlinks;
        var output = ''

        for (var i = 0; i <= backlinks.length; i++) {
          if (i === backlinks.length) {
            message.channel.send(output)
            return;
          }

          obj = backlinks[i];
          output = output + obj.title + '\n';
        }
      })
      break;
    }

    case 'block': {
      var user = argument('u', message.content);
      var duration = argument('d', message.content);
      var reason = argument('r', message.content);

      if (user && duration && reason) {
        let embed = new Discord.MessageEmbed()
          .setColor('#C51111')
          .setTitle('Blocked User')
          .setURL(`${server}/wiki/Special:BlockList`)
          .addFields(
            {name: 'User', value: `[${user}](${server}/wiki/User:${user})`},
            {name: 'Duration', value: duration, inline: true},
            {name: 'Reason', value: reason, inline: true},
          )
          .setTimestamp()

        message.react(config.waitingEmoji);

        await bot.block({
          user: user,
          expiry: duration,
          reason: reason,
          autoblock: config.autoblock,
          allowUserTalk: config.blockAllowUserTalk,
          reblock: true
        });

        message.channel.send(embed);
      }
      break;
    }

    case 'delete': {
      var title = quoted[0];
      quoted.shift();
      var reason = quoted.join(' ') || '';

      if (title) {
        let embed = new Discord.MessageEmbed()
          .setColor('#C51111')
          .setTitle('Deleted Page')
          .addFields(
            {name: 'Page', value: `[${title}](${server}/wiki/${title})`},
            {name: 'Reason', value: reason || 'None', inline: true},
          )
          .setTimestamp()

        message.react(config.waitingEmoji);

        await bot.delete({
          title: title,
          reason: reason
        });

        message.channel.send(embed);
      }
      break;
    }

    case 'getconfig': {
      if (config[spaced]) {
        message.channel.send(config[spaced]);
      } else {
        message.react(config.errorEmoji);
      }
      break;
    }

    case 'setconfig': {
      if (!args) {message.react(config.errorEmoji); return}
      let key = args.shift();
      config[key] = args.join(' ');

      fs.writeFile('./config.json', JSON.stringify(config, null, 2), function writeJSON(err) {
        if (err) {message.react(config.errorEmoji); message.channel.send(err); return}
      });

      if (key === 'wiki') {
        bot.logout();
        const server = 'https://' + config.wiki + '.fandom.com';
        const bot = new MediaWikiJS({
          url: server + '/api.php'
        });
        await bot.login(process.env.botUsername, process.env.botPassword);
        console.log(`Logged in to ${bot.api.options.url} as ${bot.api.options.botUsername}`);
      }
      break;
    }

    case 'categorize': {
      let category = lines[0].split(/ +/g);
      category.shift();
      category = category.join(' ');
      lines.shift()

      message.react(config.waitingEmoji);

      lines.forEach(title => {
        bot.append({
          title: title,
          content: `[[Category:${category}]]`,
          summary: `Adding ${category} category`,
          minor: true
        });
      })
      break;
    }

    case 'protect': {
      await bot.protect({
        title: quoted[0],
        protections: {
          edit: quoted[1],
          move: quoted[4] || quoted[1]
        },
        expiry: 'never',
        reason: quoted[3] || '',
        cascade: false
      });
      break;
    }

    case 'help': {
      if (args[0]) {
        let cmd = args[0];
        if (help[cmd]) {
          let usage = config.prefix + cmd;
          if (help[cmd].usage != undefined) {usage = usage + ' ' + help[cmd].usage}

          var embed = new Discord.MessageEmbed()
            .setTitle('Help - ' + cmd.toLocaleUpperCase())
            .setDescription('All <args> are required, but all [args] are optional.')
            .addFields(
              {name: 'Description', value: help[cmd].description},
              {name: 'Usage', value: usage},
            )
          if (help[cmd].info) {
            embed.addFields(
              {name: 'Info', value: help[cmd].info}
            )
          }
        } else {
          message.react(config.errorEmoji);
          return;
        }
      } else {
        let commands = Object.keys(help).join('\n');
        var embed = new Discord.MessageEmbed()
          .setTitle('Available Commands')
          .setDescription(commands)
          .addFields(
            {name: 'Wiki', value: `[${bot.api.options.url}](${bot.api.options.url})`, inline: true},
            {name: 'Wiki User', value: `${bot.api.options.botUsername}`, inline: true},
          )
      }
      message.channel.send(embed);
    }
    break;
  }
});

client.login(process.env.token);