const {Client, MessageEmbed} = require('discord.js');

const config = require('./prodconfig.json');

const zfill = require('./utils/zfill.js');

var mysql = require('mysql');

var sql = mysql.createConnection({
    host: 'localhost',
    port: '3306',
    user: 'root',
    password: '',
    database: 'invitation_manager'
});

var lastTimeSinceReminder = [];

sql.connect( function(err) {
    if (err) throw err;
    console.log('Connected to MySQL!');
});

const client = new Client();

//TODO: Rewrite this whole function in a better way.

function timeUpdate() {
    
    let currentTime = new Date();

    let sqlQuery = 'SELECT assignature, platform, date, messageID FROM invitations';
    
    sql.query(sqlQuery, function (err, result, fields) {
        if (err) throw err;

        var sleepUpdates = false;

        result.forEach(element => {

            let currentMinutes = (currentTime.getHours() * 60) + currentTime.getMinutes();
            let targetMinutes = (element.date.getHours() * 60) + element.date.getMinutes();

            const assignature = element.assignature;
            const DeleteMessageID = element.messageID; // ? What was this for?, EDIT: It is for the non-working function, that's why it says it's declared but not used.
            
            // ! IMHO, this is the worst way of freezing the reminder check.

            lastTimeSinceReminder.forEach( element => {
                if (element.assignature != assignature) {
                    return;
                } 
                if (currentMinutes <= (element.time + 30)) {
                    sleepUpdates = true;
                    return;
                }
            });

            if(sleepUpdates) {
                return;
            }

            let TimeSinceReminder = {
                time: currentMinutes,
                assignature:  assignature
            };

            let assignatureID = -1;

            config.channels.names.forEach( function(element, index) {
                if (element == assignature) {
                    assignatureID = index;
                }
            });

            if (assignatureID === -1) {
                msg.reply('**Error: Invalid Destination Channel!**');
                return;
            }

            let dstchannel = client.channels.cache.get(config.channels.general);

            dstchannel = client.channels.cache.get(config.channels.ids[assignatureID]);

            if (targetMinutes > currentMinutes && targetMinutes <= (currentMinutes + 30)) {

                lastTimeSinceReminder.push(TimeSinceReminder);
    
                const msgBody = '**Reunión en 30 minutos**';

                const embed = new MessageEmbed()
                // Set the title of the field
                .setTitle('**Recordatorio!**')
                // Set the color of the embed
                .setColor(0xff0000)
                // Set the main content of the embed
                .setDescription(msgBody);
    
                if(dstchannel !== undefined) {
                    dstchannel.send(embed).then( sent => {
                        sent.react(config.emojis.done);

                        console.log("\n\x1b[33mReminding about invitation " + element.id + ".\n\x1b[0m");
                    });
                }
                else {
                    client.channels.get(config.channels.general).reply('\n**An unexpected error has ocurred while executing the command!**\n```- Debugging Information: 0x0001 ERROR WHILE RETRIEVING DSTCHANNEL.```');
                }
            }

            // ! This does not work (Why???)

            /*
            else if (targetMinutes < currentMinutes) {
                dstchannel.messages.fetch(DeleteMessageID).then( msg => {
                    if(msg.embeds.length > 0) {
                        msg.edit('**Esta reunión ha vencido**');
                        msg.reactions.removeAll();
                        msg.suppressEmbeds(true);
                    }
                });
            }
            */
        });
    });
}

client.on('ready', () => {
    console.log('Logged in as ' + client.user.tag + '!');

    client.generateInvite({
        permissions: ['SEND_MESSAGES', 'MANAGE_GUILD', 'MENTION_EVERYONE', 'MANAGE_MESSAGES', 'EMBED_LINKS'],
      })
        .then(link => console.log(`Generated bot invite link: ${link}`))
        .catch(console.error);

    client.setInterval(timeUpdate, {delay: 2000});
});

client.on('message', msg => {
    if (!msg.content.startsWith(config.prefix) || msg.author.bot) return;

    if(msg.guild != config.currentGuild) {
        msg.reply('**This guild is not enabled!**');
        return;
    }

    const args = msg.content.slice(config.prefix.length).trim().split(' ');
    const command = args.shift().toLowerCase();

    const command_author = msg.author.tag;

    switch(command) {
        case 'help':
            if(args !== undefined && args.length == 1) {
                switch(args[0]) {
                    case 'create':
                        const msgBody = '```\n##create platformID assignature date time meetingHyperlink```';

                        const embed = new MessageEmbed()
                        // Set the title of the field
                        .setTitle('**Usage of ##create**')
                        // Set the color of the embed
                        .setColor(0x00ffee)
                        // Set the main content of the embed
                        .setDescription(msgBody);
                        // Send the embed to the same channel as the message
                        msg.reply(embed);

                        break;
                }
            }
            else {
                const msgBody = '\nInvitationManager™ Version ' + config.version + '\nCopyright © H4ck Software 2017-2021.';

                const embed = new MessageEmbed()
                // Set the title of the field
                .setTitle('**About**')
                // Set the color of the embed
                .setColor(0x00ffee)
                // Set the main content of the embed
                .setDescription(msgBody);
                // Send the embed to the same channel as the message
                msg.reply(embed).then( sent => {
                    sent.react(config.emojis.pinching).then( sent => {
                        sent.message.react(config.emojis.glasses).then( sent => {
                            sent.message.react(config.emojis.flushed);
                        });
                    });
                });
            }
            break;
        
        /**
         * @brief Function to create an invitation 
         * 
         */

        // ! Why would anyone feed wrong data as arguments, right?

        // TODO: Put this code into its own function and module.
        // TODO: Check that the arguments are completely valid.
        
        case 'create': // ##create platformID assignature date time meetingHyperlink

            if (args.length !== 5) {
                msg.reply('**Error: Not enough arguments!**');
                return;
            }

            const platform = config.platforms.find(args[0]);

            if (platform === undefined) {
                msg.reply('**Error: Invalid Platform ID!**');
                return;
            }

            let assignatureID = -1;

            config.channels.names.forEach( function(element, index) {
                if (element == args[1]) {
                    assignatureID = index;
                }
            });

            if (assignatureID === -1) {
                msg.reply('**Error: Invalid Destination Channel!**');
                return;
            }

            const assignatureName = config.channels.display[assignatureID];

            let everyone = msg.guild.roles.cache.find(x => x.name === '@everyone');

            let argDate = args[2].trim().split('/');
            let argTime = args[3].trim().split(':');

            if(argDate.length !== 3) {
                msg.reply('**Error: Invalid Date!**');
                return;
            }

            if(argTime.length !== 2) {
                msg.reply('**Error: Invalid Time!**');
                return;
            }

            let invitationDate = new Date(argDate[2], (argDate[1] - 1), argDate[0], argTime[0], argTime[1], 0, 0);

            let invitationDateString = invitationDate.toLocaleString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

            let invitationTimeString = zfill.string(invitationDate.getHours()) + ':' + zfill.string(invitationDate.getMinutes());

            const msgBody = everyone.toString() + '\n\n```Fecha: ' + invitationDateString + '\nHora: ' + invitationTimeString + '\nPlataforma: ' + platform + '\nAsignatura: ' + assignatureName + '```\n\n' + '[Haz Click Aquí Para Ingresar](' + args[4] + ')';

            const embed = new MessageEmbed()
            // Set the title of the field
            .setTitle('**Nueva Reunión**')
            // Set the color of the embed
            .setColor(0xff0000)
            // Set the main content of the embed
            .setDescription(msgBody);
            // Send the embed to the same channel as the message

            let dstchannel = client.channels.cache.get(config.channels.general);

            dstchannel = client.channels.cache.get(config.channels.ids[assignatureID]);

            if(dstchannel !== undefined) {
                dstchannel.send(embed).then( sent => {

                    var SentMessageID = sent.id;

                    sent.mentions.everyone = true;

                    sent.react(config.emojis.done).then( () => {
                        msg.react(config.emojis.flushed).then( () => {
                            msg.react(config.emojis.ok).then( () => {

                                let sqlDateString = invitationDate.getFullYear() + '-' + zfill.string(invitationDate.getMonth() + 1) + '-' + zfill.string(invitationDate.getDate()) + ' ' + zfill.string(invitationDate.getHours()) + ':' + zfill.string(invitationDate.getMinutes()) + '';
                                
                                let sqlQuery = 'INSERT INTO invitations (assignature, platform,  date, link, messageID) VALUES (\'' + args[1] + '\', \'' + args[0] + '\', \'' + sqlDateString + '\', \'' + args[4] + '\', ' + SentMessageID + ')'

                                sql.query(sqlQuery, function (err, result) {
                                    if (err) throw err;

                                    console.log("\n\x1b[32mA new invitation has been created:\n\tAuthor: " + command_author + "\n\tAssignature: " + assignatureName + "\n\tDate: " + sqlDateString + "\n\x1b[0m"); // * I don't know why I didn't make this sooner.
                                });
                            });
                        });
                    });
                });
            }
            else {
                msg.reply('\n**An unexpected error has ocurred while executing the command!**\n```- Debugging Information: 0x0001 ERROR WHILE RETRIEVING DSTCHANNEL.```');
            }

            break;
        case 'list':
            switch(args[0]) {
                case 'platforms':                    

                    let platformListMsgBody = new String('\n\n');

                    config.platforms.forEach( function(element, index) {
                        var platformDesc = '**' + element + '**\n```ID: ' + index + '```\n';

                        platformListMsgBody = platformListMsgBody.concat(platformDesc);
                    });

                    const platformListEmbed = new MessageEmbed()
                    // Set the title of the field
                    .setTitle('**Listado de Plataformas**')
                    // Set the color of the embed
                    .setColor(0x00ffee)
                    // Set the main content of the embed
                    .setDescription(platformListMsgBody);
                    // Send the embed to the same channel as the message

                    msg.reply(platformListEmbed);

                    break;
                case 'assignatures':                    

                    let assignatureListMsgBody = new String('\n\n');

                    config.channels.display.forEach( function(element, index) {
                        var platformDesc = '**' + element + '**\n```ID: ' + config.channels.names[index] + '```\n';

                        assignatureListMsgBody = assignatureListMsgBody.concat(platformDesc);
                    });

                    const assignatureListEmbed = new MessageEmbed()
                    // Set the title of the field
                    .setTitle('**Listado de Asignaturas**')
                    // Set the color of the embed
                    .setColor(0x00ffee)
                    // Set the main content of the embed
                    .setDescription(assignatureListMsgBody);
                    // Send the embed to the same channel as the message

                    msg.reply(assignatureListEmbed);

                    break;
            }
        break;
    }
});

client.login(config.token);
