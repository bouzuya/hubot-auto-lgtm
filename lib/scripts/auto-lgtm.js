// Description
//   A Hubot script to add a comment with lgtm.in/g image
//
// Configuration:
//   HUBOT_AUTO_LGTM_INTERVAL
//   HUBOT_AUTO_LGTM_GITHUB_TOKEN
//   HUBOT_AUTO_LGTM_GOOGLE_EMAIL
//   HUBOT_AUTO_LGTM_GOOGLE_KEY
//   HUBOT_AUTO_LGTM_GOOGLE_SHEET_KEY
//
// Commands:
//   None
//
// Author:
//   bouzuya <m@bouzuya.net>
//
var GitHub, Promise, cheerio, config, createComment, fetchComments, getLgtmUrl, loadCells, loadRepos, parseConfig, request;

GitHub = require('github');

loadCells = require('../google-sheet');

parseConfig = require('hubot-config');

Promise = require('es6-promise').Promise;

request = require('request-b');

cheerio = require('cheerio');

config = parseConfig('auto-lgtm', {
  interval: 10000,
  githubToken: null,
  googleEmail: null,
  googleKey: null,
  googleSheetKey: null
});

loadRepos = function(config) {
  return loadCells({
    credentials: {
      email: config.googleEmail,
      key: config.googleKey
    },
    spreadsheetKey: config.googleSheetKey
  }).then(function(cells) {
    return cells.filter(function(i) {
      return i.title.match(/^A/);
    }).filter(function(i) {
      return i.content.match(/([^\/]+)\/([^\/]+)/);
    }).map(function(i) {
      return i.content.match(/([^\/]+)\/([^\/]+)/);
    }).map(function(i) {
      return {
        user: i[1],
        repo: i[2]
      };
    });
  });
};

fetchComments = function(user, repo) {
  return new Promise(function(resolve, reject) {
    var github;
    github = new GitHub({
      version: '3.0.0'
    });
    return github.issues.repoComments({
      user: user,
      repo: repo,
      sort: 'created',
      direction: 'desc'
    }, function(err, data) {
      if (err != null) {
        return reject(err);
      } else {
        return resolve(data);
      }
    });
  });
};

createComment = function(token, user, repo, number, body) {
  return new Promise(function(resolve, reject) {
    var github;
    github = new GitHub({
      version: '3.0.0'
    });
    github.authenticate({
      type: 'oauth',
      token: token
    });
    return github.issues.createComment({
      user: user,
      repo: repo,
      number: number,
      body: body
    }, function(err, data) {
      if (err != null) {
        return reject(err);
      } else {
        return resolve(data);
      }
    });
  });
};

getLgtmUrl = function() {
  return request('http://www.lgtm.in/g').then(function(r) {
    var $, id;
    $ = cheerio.load(r.body);
    id = $('#dataUrl').val().match(/http:\/\/www.lgtm.in\/i\/(.+)$/)[1];
    return '![](http://www.lgtm.in/p/' + id + ')';
  });
};

module.exports = function(robot) {
  var repos, updateComment, watch;
  repos = [];
  updateComment = function(data) {
    var issues;
    issues = data.map(function(i) {
      var number, p, repo, user, _, _ref;
      p = /https:\/\/api\.github\.com\/repos\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/;
      _ref = i.issue_url.match(p), _ = _ref[0], user = _ref[1], repo = _ref[2], number = _ref[3];
      return {
        issue_url: i.issue_url,
        user: user,
        repo: repo,
        number: number
      };
    }).reduce(function(issues, i) {
      if (issues.filter(function(j) {
        return j.issue_url === i.issue_url;
      }).length > 0) {
        return issues;
      } else {
        return issues.concat(i);
      }
    }, []);
    return Promise.all(issues.map(function(i) {
      return getLgtmUrl().then(function(lgtm) {
        return createComment(config.githubToken, i.user, i.repo, i.number, lgtm);
      });
    }));
  };
  watch = function() {
    var reposString;
    reposString = repos.map(function(i) {
      return "" + i.user + "/" + i.repo;
    }).join(',');
    robot.logger.info('hubot-auto-lgtm: watch repos ' + reposString);
    return setTimeout(function() {
      var promises;
      promises = repos.map(function(i) {
        return fetchComments(i.user, i.repo).then(function(data) {
          data = data.filter(function(j) {
            return (i.createdAt == null) || i.createdAt < j.created_at;
          });
          if (data.length === 0) {
            return;
          }
          if (i.createdAt == null) {
            i.createdAt = data[0].created_at;
            return;
          }
          i.createdAt = data[0].created_at;
          data = data.filter(function(j) {
            return j.body.match(/lgtm/i);
          });
          return updateComment(data);
        });
      });
      return Promise.all(promises)["catch"](function(e) {
        return robot.logger.error(e);
      }).then(watch, watch);
    }, parseInt(config.interval, 10));
  };
  loadRepos(config).then(function(r) {
    var reposString;
    reposString = r.map(function(i) {
      return "" + i.user + "/" + i.repo;
    }).join(',');
    robot.logger.info('hubot-auto-lgtm: load repos ' + reposString);
    return repos = r;
  })["catch"](function(e) {
    return robot.logger.error(e);
  });
  return watch();
};
