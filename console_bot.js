var builder = require('botbuilder');
var moment = require('moment');
var iothub = require('azure-iothub');

var LuisApi = require('./luis_api.js');
var config = require('./config.json');

var luisApi = new LuisApi(config.luisAppId, config.luisSubscriptionKey);
var dialog = new builder.LuisDialog(luisApi.getModelUri());

// Create bot and add dialogs
var bot = new builder.TextBot();
bot.add('/', dialog);
dialog.on('ScheduleJob', '/schedulejob');
dialog.on('FindDevicesByTag', '/finddevicesbytag');
dialog.onDefault(builder.DialogAction.send('sorry, no clue...'));

bot.add('/finddevicesbytag', [
    function (session, results, next) {
        session.dialogData.tags = [];
        var tags = builder.EntityRecognizer.findAllEntities(results.entities, 'Property::TagProperty');
        if (tags.length > 0) {
            tags.forEach(function (tag) {
                session.dialogData.tags.push(tag.entity);
            });
            session.send('Tags to look for: ' + JSON.stringify(session.dialogData.tags));
            builder.Prompts.confirm(session, 'Would you like to add other tags?');
        } else {
            builder.Prompts.text(session, 'What tags do you want to look for?');
        }
    },
    function (session, results, next) {
        if (results.response === true) {
            builder.Prompts.text(session, 'Alright, what tags do you want to look for?');
        } else if (results.response === false) {
            session.dialogData.tagsReady = true;
            next();
        } else if (results.response) {
            next(results);
        } else {
            session.endDialog({
                resumed: builder.ResumeReason.notCompleted
            });
        }
    },
    function (session, results, next) {
        var tags = null;
        if (!session.dialogData.tagsReady) {
            if (results.response.indexOf(';') > 0) {
                tags = results.response.split(';');
            } else if (results.response.indexOf(',') > 0) {
                tags = results.response.split(',');
            } else {
                tags = results.response.split(' ');
            }
            if (tags.length > 0) {
                tags.forEach(function (tag) {
                    session.dialogData.tags.push(tag);
                });
            } else {
                session.endDialog({
                    resumed: builder.ResumeReason.notCompleted
                });
            }

            session.dialogData.tagsReady = true;
        }

        session.send('Looking for devices with the following tags: ' + JSON.stringify(session.dialogData.tags) + '...');
        var registry = iothub.Registry.fromConnectionString(config.iothubConnectionString);
        registry.queryDevicesByTags(session.dialogData.tags, 10, function (err, result) {
            if (err) {
                session.send('Error: could not find devices');
                session.endDialog();
            } else {
                var plural = (result.length > 1) ? 's' : '';
                session.send('Found ' + result.length + ' device' + plural + ':');
                result.forEach(function(device) {
                    session.send('  -> ' + device.deviceId);
                });
                
                session.userData.devices = result;
                session.endDialog();
            }
        });
    }
]);


var jobTypes = ['Job::RebootJob', 'Job::FactoryResetJob', 'Job::FirmwareUpdateJob']
bot.add('/schedulejob', [
    function (session, results, next) {
        if (session.userData.devices.length <= 0) {
            session.beginDialog('/finddevicesbytag');
        } else {
            for (var i = 0; i < jobTypes.length; i++) {
                var tryType = builder.EntityRecognizer.findEntity(results.entities, jobTypes[i]);
                if (tryType) {
                    session.dialogData.jobType = tryType.type;
                    break;
                }
            }

            session.dialogData.targetTime = builder.EntityRecognizer.resolveTime(results.entities);
            if (!session.dialogData.jobType) {
                builder.Prompts.choice(session, 'What type of job would you like to schedule?', jobTypes);
            } else {
                next();
            }
        }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.jobType = results.response;
        }

        if (!session.dialogData.targetTime) {
            builder.Prompts.time(session, 'At what time would you like the ' + session.dialogData.jobType + ' to run?');
        } else {
            next();
        }
    },
    function (session, results, next) {
        if (results.response) {
            session.dialogData.targetTime = builder.EntityRecognizer.resolveTime([results.response]);
        }

        var momentTime = moment.utc(session.dialogData.targetTime);
        builder.Prompts.confirm(session, 'Shedule a ' + session.dialogData.jobType + ' for ' + momentTime.format('llll') + '? (yes/no)');
    },
    function (session, results, next) {
        if (results.response) {
            var momentTime = moment.utc(session.dialogData.targetTime);
            console.log('Scheduling: ' + session.dialogData.jobType);
            console.log('at: ' + momentTime.format('llll'));
            console.log('For the following devices: ');
            session.userData.devices.forEach(function (device) {
                console.log('\t- ' + device.deviceId);
            });

            session.endDialog();
        } else {
            session.endDialog({
                resumed: builder.ResumeReason.notCompleted
            });
        }
    }
]);

bot.listenStdin();