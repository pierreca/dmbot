var iothub = require('azure-iothub');
var devices = require('./devices2.json');
var config = require('./config.json');

var registry = new iothub.Registry.fromConnectionString(config.iothubConnectionString);

var deviceIndex = 0;
var createInterval = setInterval(function () {
  devices.forEach(function(device) {
    registry.create(device, function(err, result) {
      if(err) {
        console.error('Could not create device: ' + device.deviceId + ': ' + err.constructor.name + ': ' + err.message);
      } else {
        console.log('Device created: ' + device.deviceId);
      }
    });
  });
  
  deviceIndex++;
  if (deviceIndex == devices.length) {
    clearInterval(createInterval);
  }
}, 1000);