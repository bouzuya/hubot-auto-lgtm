
var GoogleSheet, Promise, google, parseString;

google = require('googleapis');

Promise = require('es6-promise').Promise;

parseString = require('xml2js').parseString;

GoogleSheet = (function() {
  GoogleSheet.visibilities = {
    "private": 'private',
    "public": 'public'
  };

  GoogleSheet.projections = {
    basic: 'basic',
    full: 'full'
  };

  function GoogleSheet(_arg) {
    this.credentials = _arg.credentials, this.spreadsheetKey = _arg.spreadsheetKey;
  }

  GoogleSheet.prototype.load = function() {
    var client, worksheetUrl;
    client = null;
    worksheetUrl = this._getWorksheetUrl({
      key: this.spreadsheetKey,
      visibilities: GoogleSheet.visibilities["private"],
      projections: GoogleSheet.projections.basic
    });
    return this._authorize(this.credentials).then(function(c) {
      return client = c;
    }).then((function(_this) {
      return function() {
        return _this._request(client, {
          url: worksheetUrl
        });
      };
    })(this)).then(this._parseXml.bind(this)).then(function(data) {
      var url, worksheetUrls;
      worksheetUrls = data.feed.entry.map(function(i) {
        return i.id[0];
      });
      url = worksheetUrls[0];
      if (url.indexOf(worksheetUrl) !== 0) {
        throw new Error();
      }
      return url.replace(worksheetUrl + '/', '');
    }).then((function(_this) {
      return function(worksheetId) {
        var cellsUrl;
        cellsUrl = _this._getCellsUrl({
          key: _this.spreadsheetKey,
          worksheetId: worksheetId,
          visibilities: GoogleSheet.visibilities["private"],
          projections: GoogleSheet.projections.basic
        });
        return _this._request(client, {
          url: cellsUrl
        });
      };
    })(this)).then(this._parseXml.bind(this)).then(function(data) {
      return data.feed.entry.map(function(i) {
        return {
          title: i.title[0]._,
          content: i.content[0]._
        };
      });
    });
  };

  GoogleSheet.prototype._authorize = function(_arg) {
    var email, key;
    email = _arg.email, key = _arg.key;
    return new Promise(function(resolve, reject) {
      var jwt, scope;
      scope = ['https://spreadsheets.google.com/feeds'];
      jwt = new google.auth.JWT(email, null, key, scope, null);
      return jwt.authorize(function(err) {
        if (err != null) {
          return reject(err);
        } else {
          return resolve(jwt);
        }
      });
    });
  };

  GoogleSheet.prototype._request = function(client, options) {
    return new Promise(function(resolve, reject) {
      return client.request(options, function(err, data) {
        if (err != null) {
          return reject(err);
        } else {
          return resolve(data);
        }
      });
    });
  };

  GoogleSheet.prototype._parseXml = function(xml) {
    return new Promise(function(resolve, reject) {
      return parseString(xml, function(err, parsed) {
        if (err != null) {
          return reject(err);
        } else {
          return resolve(parsed);
        }
      });
    });
  };

  GoogleSheet.prototype._listSpreadsheetsUrl = function(client) {
    var baseUrl, projections, visibilities;
    baseUrl = 'https://spreadsheets.google.com/feeds';
    visibilities = GoogleSheet.visibilities["private"];
    projections = GoogleSheet.projections.full;
    return "" + baseUrl + "/spreadsheets/" + visibilities + "/" + projections;
  };

  GoogleSheet.prototype._getWorksheetUrl = function(_arg) {
    var baseUrl, key, projections, visibilities;
    key = _arg.key, visibilities = _arg.visibilities, projections = _arg.projections;
    baseUrl = 'https://spreadsheets.google.com/feeds';
    return "" + baseUrl + "/worksheets/" + key + "/" + visibilities + "/" + projections;
  };

  GoogleSheet.prototype._getCellsUrl = function(_arg) {
    var baseUrl, key, projections, visibilities, worksheetId;
    key = _arg.key, worksheetId = _arg.worksheetId, visibilities = _arg.visibilities, projections = _arg.projections;
    baseUrl = 'https://spreadsheets.google.com/feeds';
    return "" + baseUrl + "/cells/" + key + "/" + worksheetId + "/" + visibilities + "/" + projections;
  };

  GoogleSheet.prototype._getWorksheetId = function(_arg) {
    var baseUrl, key, projections, visibilities;
    key = _arg.key, visibilities = _arg.visibilities, projections = _arg.projections;
    baseUrl = 'https://spreadsheets.google.com/feeds';
    return "" + baseUrl + "/worksheets/" + key + "/" + visibilities + "/" + projections;
  };

  return GoogleSheet;

})();

module.exports = function(config) {
  return new GoogleSheet(config).load();
};
