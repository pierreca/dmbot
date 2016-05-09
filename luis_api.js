var https = require('https');

function LuisApi(appId, subscriptionKey) {
  this.appId = appId;
  this.subscriptionKey = subscriptionKey;
  this.endpoints = {
    hostname: "api.projectoxford.ai",
    service: '/luis/v1/application?id=' + this.appId + '&subscription-key=' + this.subscriptionKey,
    phraselists: '/luis/v1.0/prog/apps/' + this.appId + '/phraselists'
  };
};

LuisApi.prototype.getModelUri = function() {
  return 'https://' + this.endpoints.hostname + this.endpoints.service;
}

LuisApi.prototype._makeHttpRequest = function (options, content) {
  return new Promise(function(resolve, reject) {
    var req = https.request(options, function (res) {
      if(res.statusCode !== 200) {
        var error = new Error(res.statusCode + ': ' + res.statusMessage);
        error.response = res;
        reject(error);
      } else {
        var body = '';
        res.on('data', function (chunk) {
          body += chunk;
        });
        
        res.on('end', function () {
          resolve(body);
        })
        
        res.on('error', function (err) {
          reject(err);        
        });
      }
    });
    
    if(content) {
      req.write(content);
    }
    req.end();    
  });
};

LuisApi.prototype.getPhraseLists = function () {
  var self = this;  
  return new Promise(function (resolve, reject) {
    var headers = {
      'Ocp-Apim-Subscription-Key': self.subscriptionKey
    };
    
    var options = {
      hostname: self.endpoints.hostname,
      path: self.endpoints.phraselists,
      method: 'GET',
      headers: headers
    };
    
    self._makeHttpRequest(options)
        .then(function (result) {
          resolve(JSON.parse(result));
        }).catch(reject);
  });
};

LuisApi.prototype.getPhraseListByName = function(phraseListName) {
  var self = this;
  return new Promise(function(resolve, reject) {
    self.getPhraseLists().then(function (phraseLists) {
      var result = null;
      phraseLists.forEach(function (phraseList) {
        if (phraseList.Name == phraseListName) {
          result = phraseList;
        }
      });
      
      resolve(result);
    }).catch(function (err) {
      reject(err);
    });
  });
};

LuisApi.prototype.createOrUpdatePhraseList = function(name, values) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.getPhraseListByName(name).then(function(phraseList) {
      if (phraseList) {
        self.updatePhraseList(name, values).then(resolve);
      } else {
        self.createPhraseList(name, values).then(resolve);
      } 
    }).catch(function(err) {
      reject(err);
    });
  });
};

LuisApi.prototype.updatePhraseList = function(name, values) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.getPhraseListByName(name).then(function(phraseList) {
      var content = JSON.stringify({
        Id: phraseList.Id,
        Name: phraseList.Name,
        Phrases: values.join(','),
        IsActive: true,
        Mode: phraseList.Mode,
        Editable: phraseList.Editable
      });

      var headers = {
        'Content-Length': content.length,
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': self.subscriptionKey
      };
      
      var options = {
        hostname: self.endpoints.hostname,
        path: self.endpoints.phraselists + '/' + phraseList.Id,
        method: 'PUT',
        headers: headers
      };

      self._makeHttpRequest(options, content)
          .then(resolve)
          .catch(reject);
    }).catch(function(err) {
      reject(err);
    });
  });
};


LuisApi.prototype.getNextPhraseListId = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.getPhraseLists().then(function(phraseLists) {
      resolve (phraseLists[phraseLists.length - 1].Id + 1);
    })
  });
};

LuisApi.prototype.createPhraseList = function(name, values) {
  var self = this;
  return new Promise(function (resolve, reject) {
    self.getNextPhraseListId().then(function(newId) {
      var content = JSON.stringify({
        Id: newId,
        Name: name,
        Phrases: values.join(','),
        IsActive: true,
        Mode: "Exchangeable",
        Editable: true
      });

      var headers = {
        'Content-Length': content.length,
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': self.subscriptionKey
      };
      
      var options = {
        hostname: self.endpoints.hostname,
        path: self.endpoints.phraselists,
        method: 'POST',
        headers: headers
      };

      self._makeHttpRequest(options, content)
          .then(resolve)
          .catch(reject);
    }).catch(function(err) {
      reject(err);
    });
  });
};

module.exports = LuisApi;