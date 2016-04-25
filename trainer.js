var https = require('https');
var Promise = require('bluebird');
var iothub = require('azure-iothub');
var storage = require('azure-storage');

var config = require('./config.json');
var LuisApi = require('./luis_api.js');

var exportDevicesToBlob = function () {
  return new Promise(function (resolve, reject) {
    var registry = iothub.Registry.fromConnectionString(config.iothubConnectionString);
    var blobSvc = storage.createBlobService(config.storageConnectionString);

    var startDate = new Date();
    var expiryDate = new Date(startDate);
    expiryDate.setMinutes(startDate.getMinutes() + 100);
    startDate.setMinutes(startDate.getMinutes() - 100);

    var outputSharedAccessPolicy = {
      AccessPolicy: {
        Permissions: 'rwd',
        Start: startDate,
        Expiry: expiryDate
      },
    };

    var outputContainerName = 'exportcontainer';

    blobSvc.createContainerIfNotExists(outputContainerName, function (error) {
      if (error) {
        reject(new Error('Could not create output container: ' + error.message));
      } else {
        var outputSasToken = blobSvc.generateSharedAccessSignature(outputContainerName, null, outputSharedAccessPolicy);
        var outputSasUrl = blobSvc.getUrl(outputContainerName, null, outputSasToken);
        registry.exportDevicesToBlob(outputSasUrl, false, function (error, result) {
          if (error) {
            reject(new Error('Could not create export job: ' + error.message));
          } else {
            console.log('--------------\r\nDevices Export Job Identifier:--------------\r\n' + result);
            var jobId = JSON.parse(result).jobId;
            var interval = setInterval(function () {
              registry.getJob(jobId, function (error, result) {
                if (error) {
                  reject(new Error('Could not get job status: ' + error.message + ' : ' + error.responseBody));
                } else {
                  console.log('--------------\r\njob ' + jobId + ' status:\r\n--------------\r\n' + result);
                  var status = JSON.parse(result).status;
                  if (status === "completed") {
                    clearInterval(interval);
                    resolve(outputContainerName);
                  }
                }
              });
            }, 500);
          }
        });
      }
    });
  });
};

var readDevicesFromExportBlob = function (containerName) {
  return new Promise(function (resolve, reject) {
    var blobSvc = storage.createBlobService(config.storageConnectionString);
    blobSvc.getBlobToText(containerName, 'devices.txt', function (err, result) {
      if (err) {
        reject(err);
      } else {
        var devicesJSON = result.split('\r\n');
        var devices = [];
        devicesJSON.forEach(function (json) {
          if (json) {
            devices.push(JSON.parse(json));
          }
        });
        resolve(devices);
      }
    });
  });
};

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

getAllDevicesFromQuery()
.then(getTagsFromDevices)
.then(function (tagArray) {
  var luis = new LuisApi(config.luisAppId, config.luisSubscriptionKey);
  return luis.updatePhraseList('Tags', tagArray);
}).then(function(){
  console.log('Training is over!');
}).catch(function (err) {
  console.error(err.message);  
});