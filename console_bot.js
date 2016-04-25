var builder = require('botbuilder');
var moment = require('moment');

var config = require('./config.json');

var dialog = new builder.LuisDialog(config.luisEndpoint);

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
            session.send('Current tags: ' + JSON.stringify(session.dialogData.tags));
            builder.Prompts.confirm(session, 'Add more tags? (yes/no)');
        } else {
            builder.Prompts.text(session, 'What tags do you want to look for?');
        }
    },
    function (session, results, next) {
        if(results.response === true){
            builder.Prompts.text(session, 'What tags do you want to look for?');            
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
        if(!session.dialogData.tagsReady) {
            if (results.response.indexOf(';') > 0) {
                tags = results.response.split(';');
            } else if (results.response.indexOf(',') > 0) {
                tags = results.response.split(',');                
            } else {
                tags = results.response.split(' ');                
            }
            if (tags.length > 0) {
                tags.forEach(function(tag){
                    session.dialogData.tags.push(tag);
                });
            } else {
                session.endDialog({
                    resumed: builder.ResumeReason.notCompleted
                }); 
            }
            
            session.dialogData.tagsReady = true;
        }
        
        session.send('Looking for devices with the following tags: ' + JSON.stringify(session.dialogData.tags));
        // query devices here
        // set the devices collection in userdata
        // call endDialog
        session.endDialog({
            response: {
                tags: session.dialogData.tags
            }
        });
    }
]);


var jobTypes = ['Job::RebootJob', 'Job::FactoryResetJob', 'Job::FirmwareUpdateJob' ]
bot.add('/schedulejob', [
    function(session, results, next) {
        if(session.userData.devices.length <= 0) {
            session.beginDialog('/finddevicesbytag');
        } else {
            for (var i = 0; i < jobTypes.length; i++) {
                var tryType = builder.EntityRecognizer.findEntity(results.entities, jobTypes[i]);
                if(tryType) {
                    session.dialogData.jobType = tryType.type;
                    break;
                }
            }
            
            session.dialogData.targetTime = builder.EntityRecognizer.resolveTime(results.entities);
            if(!session.dialogData.jobType) {
                builder.Prompts.choice(session, 'What type of job would you like to schedule?', jobTypes);
            } else {
                next();
            }
        }
    },
    function (session, results, next) {
        if(results.response) {
            session.dialogData.jobType = results.response;
        }
        
        if(!session.dialogData.targetTime) {
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
            // schedule the job here
            session.endDialog({
                response: {
                    jobType: session.dialogData.jobType,
                    time: session.dialogData.targetTime
                }
            });
        } else {
            session.endDialog({
                resumed: builder.ResumeReason.notCompleted
            });
        }
    }
]);
        
bot.listenStdin();