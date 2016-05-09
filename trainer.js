var https = require('https');
var Promise = require('bluebird');
var iothub = require('azure-iothub');
var storage = require('azure-storage');

var config = require('./config.json');
var LuisApi = require('./luis_api.js');

var getAllDevicesFromQuery = function () {
  return new Promise(function (resolve, reject) {
    var registry = iothub.Registry.fromConnectionString(config.iothubConnectionString);
    var query = {
      project: null,
      aggregate: null,
      sort: null,
      filter: null
    };
    
    registry.queryDevices(query, function (err, result) {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    })
  });
};

var getTagsFromDevices = function(deviceArray) {
  return new Promise(function (resolve, reject) {
    var tags = [];
    deviceArray.forEach(function (device) {
      device.serviceProperties.tags.forEach(function (tag){
        if(!(tags.indexOf(tag) >= 0)) {
          tags.push(tag);
        }
      });
    });
    resolve(tags);
  });
};

var getServicePropertiesFromDevices = function(deviceArray) {
  return new Promise(function (resolve, reject) {
    var servicePropKeys = [];
    var servicePropValues = [];
    deviceArray.forEach(function (device) {
      for (var prop in device.serviceProperties.properties) {
        if (!(servicePropKeys.indexOf(prop) >= 0)) {
          servicePropKeys.push(prop);
        }
        
        var propValue = device.serviceProperties.properties[prop];
        if (typeof propValue !== 'number' && !(servicePropValues.indexOf(propValue) >= 0)) {
          servicePropValues.push(propValue);
        }
      }
    });
    
    resolve({ keys: servicePropKeys, values: servicePropValues});
  });
};

var getDevicePropertyKeys = function() {
  return new Promise(function (resolve, reject) {
    var sampleDevice = new iothub.Device();
    var devicePropKeys = [];
    for (var prop in sampleDevice.deviceProperties) {
      devicePropKeys.push(prop);
    }
    
    resolve(devicePropKeys);
  });
};

getAllDevicesFromQuery()
.then(function (devices) {
  return Promise.all([
    getTagsFromDevices(devices).then(function (tagArray) {
      var luis = new LuisApi(config.luisAppId, config.luisSubscriptionKey);
      return luis.createOrUpdatePhraseList('Tags', tagArray);
    }),
    getServicePropertiesFromDevices(devices).then(function (servicePropArrays) {
      var luis = new LuisApi(config.luisAppId, config.luisSubscriptionKey);
      return Promise.all([
        luis.createOrUpdatePhraseList('ServicePropertyKeys', servicePropArrays.keys),
        luis.createOrUpdatePhraseList('ServicePropertyValues', servicePropArrays.values)
      ]);
    }),
    getDevicePropertyKeys().then(function(devicePropKeyArray) {
      var luis = new LuisApi(config.luisAppId, config.luisSubscriptionKey);
      return luis.createOrUpdatePhraseList('DevicePropertyKeys', devicePropKeyArray);
    })
  ]);
}).then(function(){
  console.log('Training is over!');
}).catch(function (err) {
  console.error(err.message);  
});