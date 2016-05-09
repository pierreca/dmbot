var uuid = require('uuid');
var fs = require('fs');

var tags = [
  'bacon',
  'ham',
  'turkey',
  'chicken',
  'beef',
  'cheddar',
  'swiss',
  'tomato',
  'lettuce',
  'onion',
  'pickle',
  'mustard',
  'ketchup',
  'mayo'
];

var customerIds = [
  123,
  234,
  345,
  456,
  567,
  678,
  789,
  890
];

var serviceBy = [
  'Contoso',
  'Fabrikam',
  'Northwind',
  'AdventureWorks',
  'BlueYonder'
];

var devicesToGenerate = process.argv[2];
var saveFile = process.argv[3];

var devices = [];
for (var i = 0; i < devicesToGenerate; i++) {
  var device = {
    deviceId: uuid.v4(),
    serviceProperties: {
      tags: [],
      properties: {}
    }
  };
  
  var randIndex = Math.round(Math.random() * serviceBy.length);
  device.serviceProperties.properties.serviceBy = serviceBy[randIndex];
  
  randIndex = Math.round(Math.random() * customerIds.length);
  device.serviceProperties.properties.customerId = customerIds[randIndex];
  
  var existingIndices = [];
  for (var t = 0; t < 5; t++) {
    do {
      randIndex = Math.round(Math.random() * tags.length);      
    } while (existingIndices.indexOf(randIndex) >= 0);
    
    existingIndices.push(randIndex);
    device.serviceProperties.tags.push(tags[randIndex]);
  }
  
  var randWeight = Math.round(Math.random() * 10000);
  device.serviceProperties.properties.weight = randWeight;
  var randQoS = Math.round(Math.random() * 10);
  device.serviceProperties.properties.qos = randQoS;
  
  devices.push(device);
}

fs.appendFile(saveFile, JSON.stringify(devices, null, 2), function (err, result) {
  if (err) {
    console.error('Error saving devices to file');
  } else {
    console.log('Done: ' + devicesToGenerate + ' generated in ' + saveFile);
  }
});