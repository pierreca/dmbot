var iothub = require('azure-iothub');
var devices = require('./devices.json');
var config = require('./config.json');

var registry = new iothub.Registry.fromConnectionString(config.iothubConnectionString);

devices.forEach(function(device) {
  registry.delete(device.deviceId, function(err, result){
    if (err) {
      console.error(err.constructor.name + ':' + err.message); 
    } else {
      registry.create(device, function(err, result) {
        if(err) {
          console.error('Could not create device: ' + device.deviceId + ': ' + err.constructor.name + ': ' + err.message);
        } else {
          console.log('Device created: ' + device.deviceId);
        }
      });
    }
  });
});