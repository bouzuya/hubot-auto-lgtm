# Description
#   A Hubot script to add a comment with lgtm.in/g image
#
# Configuration:
#   HUBOT_AUTO_LGTM_INTERVAL
#   HUBOT_AUTO_LGTM_GITHUB_TOKEN
#   HUBOT_AUTO_LGTM_GOOGLE_EMAIL
#   HUBOT_AUTO_LGTM_GOOGLE_KEY
#   HUBOT_AUTO_LGTM_GOOGLE_SHEET_KEY
#
# Commands:
#   None
#
# Author:
#   bouzuya <m@bouzuya.net>
#
GitHub = require 'github'
loadCells = require '../google-sheet'
parseConfig = require 'hubot-config'
{Promise} = require 'es6-promise'
request = require 'request-b'
cheerio = require 'cheerio'

config = parseConfig 'auto-lgtm',
  interval: 10000
  githubToken: null
  googleEmail: null
  googleKey: null
  googleSheetKey: null

loadRepos = (config) ->
  loadCells
    credentials:
      email: config.googleEmail
      key: config.googleKey
    spreadsheetKey: config.googleSheetKey
  .then (cells) ->
    cells
      .filter (i) -> i.title.match(/^A/)
      .filter (i) -> i.content.match(/([^\/]+)\/([^\/]+)/)
      .map (i) -> i.content.match(/([^\/]+)\/([^\/]+)/)
      .map (i) -> user: i[1], repo: i[2]

fetchComments = (user, repo) ->
  new Promise (resolve, reject) ->
    github = new GitHub(version: '3.0.0')
    github.issues.repoComments
      user: user
      repo: repo
      sort: 'created'
      direction: 'desc'
    , (err, data) ->
      if err? then reject(err) else resolve(data)

createComment = (token, user, repo, number, body) ->
  new Promise (resolve, reject) ->
    github = new GitHub(version: '3.0.0')
    github.authenticate(type: 'oauth', token: token)
    github.issues.createComment { user, repo, number, body }, (err, data) ->
      if err? then reject(err) else resolve(data)

getLgtmUrl = ->
  request('http://www.lgtm.in/g').then (r) ->
    $ = cheerio.load r.body
    id = $('#dataUrl').val().match(/http:\/\/www.lgtm.in\/i\/(.+)$/)[1]
    '![](http://www.lgtm.in/p/' + id + ')'


module.exports = (robot) ->
  repos = []

  updateComment = (data) ->
    issues = data
    .map (i) ->
      p = /https:\/\/api\.github\.com\/repos\/([^\/]+)\/([^\/]+)\/issues\/(\d+)/
      [_, user, repo, number] = i.issue_url.match(p)
      { issue_url: i.issue_url, user, repo, number }
    .reduce (issues, i) ->
      if issues.filter((j) -> j.issue_url is i.issue_url).length > 0
        issues
      else
        issues.concat(i)
    , []
    Promise.all(issues.map (i) ->
      getLgtmUrl().then (lgtm) ->
        createComment(config.githubToken, i.user, i.repo, i.number, lgtm)
    )

  watch = ->
    reposString = repos.map((i) -> "#{i.user}/#{i.repo}").join(',')
    robot.logger.info 'hubot-auto-lgtm: watch repos ' + reposString
    setTimeout ->
      promises = repos.map (i) ->
        fetchComments(i.user, i.repo)
        .then (data) ->
          data = data.filter (j) -> !i.createdAt? or i.createdAt < j.created_at
          return if data.length is 0
          unless i.createdAt?
            i.createdAt = data[0].created_at
            return
          i.createdAt = data[0].created_at
          data = data.filter (j) -> j.body.match(/lgtm/i)
          updateComment(data)
      Promise.all(promises)
      .catch (e) ->
        robot.logger.error e
      .then watch, watch
    , parseInt(config.interval, 10)

  loadRepos(config).then (r) ->
    reposString = r.map((i) -> "#{i.user}/#{i.repo}").join(',')
    robot.logger.info 'hubot-auto-lgtm: load repos ' + reposString
    repos = r
  .catch (e) ->
    robot.logger.error e

  watch()
