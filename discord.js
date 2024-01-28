const { Client, Intents } = require('discord.js');
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const axios = require('axios');

const commands = [
  {
    name: 'ping',
    description: 'Replies with the bot\'s latency.',
  },
  {
    name: 'restart',
    description: 'Restarts the bot',
  },
  {
    name: 'genkey',
    description: 'Generates a key.',
    options: [
      {
        name: 'user',
        type: 6,
        description: 'User to mention and log the key for.',
        required: true,
      },
    ],
  },
  {
    name: 'resethwid',
    description: 'Resets HWID for a key.',
    options: [
      {
        name: 'key',
        type: 3,
        description: 'key to reset HWID.',
        required: true,
      },
    ],
  },
  {
    name: 'keydata',
    description: 'Get HWID, IP etc from a key.',
    options: [
      {
        name: 'key',
        type: 3,
        description: 'Key that you want to get the information from.',
        required: true,
      },
    ],
  },
  {
];

const token = 'your discord bot token here';
const clientId = 'your discord bot id here';
const guildId = 'your discord server id here';
const adminUserIds = ['admin userid 1', 'admin userid 2'];
const logChannelId = 'channel id for logs';

const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });

const rest = new REST({ version: '9' }).setToken(token);

(async () => {
  try {
    console.log('Started refreshing application (/) commands.');

    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands },
    );

    console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
    console.error(error);
  }
})();

client.on('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return;

  const { commandName, options, user } = interaction;

  if (!adminUserIds.includes(user.id)) {
    await interaction.reply('You do not have permission to use this command.');
    return;
  }

  if (commandName === 'ping') {
    const latency = Date.now() - interaction.createdTimestamp;
    await interaction.reply(`Pong! Latency: ${latency}ms`);
  } else if (commandName === 'restart' && user.id === adminUserId) {
    await interaction.reply('Restarting...');

    process.exit();
  } else 
  if (commandName === 'genkey') {
    const mentionedUser = options.getUser('user');
    const channel = interaction.channel;
  
    const keyTypeOptions = [
      { label: 'One-Time', value: 'onetime' },
      { label: 'Lifetime', value: 'lifetime' },
    ];
  
    const keyTypeSelect = {
      customId: 'keyTypeSelect',
      placeholder: 'Select key type',
      options: keyTypeOptions,
    };
  
    try {
      const initialMessage = await interaction.reply({
        content: 'Choose the key type:',
        components: [
          {
            type: 1,
            components: [
              {
                type: 3,
                customId: keyTypeSelect.customId,
                placeholder: keyTypeSelect.placeholder,
                options: keyTypeSelect.options,
              },
            ],
          },
        ],
      });
  
      const filter = i => i.customId === keyTypeSelect.customId && i.user.id === interaction.user.id;
      const collector = interaction.channel.createMessageComponentCollector({ filter, time: 15000 });
  
      collector.on('collect', async i => {
        collector.stop();
        await i.deferUpdate();
      
        const keyType = i.values[0];
      
        let apiUrl;
        let mask;
      
        if (keyType === 'onetime') {
          apiUrl = 'https://keyauth.win/api/seller/?sellerkey=yoursellerkey&type=add&format=JSON&expiry=1&mask=ONE-***-***&level=1&amount=1&owner=SellerAPI&character=2&note=discordbot';
          mask = 'ONE';
        } else if (keyType === 'lifetime') {
          apiUrl = 'https://keyauth.win/api/seller/?sellerkey=yoursellerkey&type=add&format=JSON&expiry=600&mask=LFT-***-***&level=1&amount=1&owner=SellerAPI&character=2&note=discordbot';
          mask = 'LFT';
        }
      
        try {
          const response = await axios.get(apiUrl);
          const key = response.data.key;
      
          await interaction.followUp(`Your ${keyType} key is: ${key}`);
      
          const logChannel = await client.channels.fetch(logChannelId);
          await logChannel.send(`Key: ${key}\nUser: ${mentionedUser}\nChannel: <#${channel.id}>\nType: ${keyType}`);
      
          i.message.delete();
        } catch (error) {
          console.error(error);
          await interaction.followUp('Failed to generate a key. Please try again later.');
        }
      });
      
      collector.on('end', collected => {
        if (collected.size === 0) {
          interaction.followUp('You took too long to select a type. Please try again.');
        }
      });
    } catch (error) {
      console.error(error);
      await interaction.reply('Failed to interact with the select menu. Please try again later.');
    }
  } else if (commandName === 'resethwid') {
    const key = options.getString('key');
    const resetUrl = `https://keyauth.win/api/seller/?sellerkey=yoursellerkey&type=resetuser&user=${key}`;

    try {
      const response = await axios.get(resetUrl);

      if (response.data.success) {
        await interaction.reply(`HWID reset for ${key}.`);
      } else {
        await interaction.reply(`Failed to reset HWID for ${key}.`);
      }
    } catch (error) {
      console.error(error);
      await interaction.reply(`Error: ${error.message}`);
    }
  } else if (commandName === 'keydata') {
    const key = options.getString('key');
    const url = `https://keyauth.win/api/seller/?sellerkey=yoursellerkey&type=userdata&user=${key}`;

    try {
      const response = await axios.get(url);
      const data = response.data;

      if ("success" in data && "ip" in data && "hwid" in data) {
        const filteredData = {
          "ip": data["ip"],
          "hwid": data["hwid"],
        };

        for (const field of ["createdate", "lastlogin"]) {
          if (field in data) {
            const timestamp = data[field];
            const datetimeObj = new Date(timestamp * 1000);
            filteredData[field] = datetimeObj.toUTCString() + ` | ${daysAgo(datetimeObj)} Days ago`;
          }
        }

        if ("subscriptions" in data && data["subscriptions"]) {
          const subscriptions = data["subscriptions"];
          const expiryDates = subscriptions.map(sub => {
            const expiryDate = new Date(sub["expiry"] * 1000);
            return expiryDate.toUTCString() + ` | ${daysLeft(expiryDate)} Days left`;
          });

          filteredData["expiry"] = expiryDates.length === 1 ? expiryDates[0] : expiryDates;
        }

        await interaction.reply(`Key Data for ${key}:\n\`\`\`json\n${JSON.stringify(filteredData, null, 4)}\n\`\`\``);
      } else {
        await interaction.reply('Unexpected response format. Unable to fetch key data.');
      }
    } catch (error) {
      console.error(error);
      await interaction.reply(`Error: ${error.message}`);
    }
  }
});

function daysAgo(date) {
  const currentDate = new Date();
  const diffTime = currentDate - date;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

function daysLeft(expiryDate) {
  const currentDate = new Date();
  const diffTime = expiryDate - currentDate;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

client.login(token);
