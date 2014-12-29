google = require 'googleapis'
{Promise} = require 'es6-promise'
{parseString} = require 'xml2js'

class GoogleSheet
  @visibilities:
    private: 'private'
    public: 'public'

  @projections:
    basic: 'basic'
    full: 'full'

  constructor: ({ @credentials, @spreadsheetKey }) ->

  load: ->
    client = null
    worksheetUrl = @_getWorksheetUrl
      key: @spreadsheetKey
      visibilities: GoogleSheet.visibilities.private
      projections: GoogleSheet.projections.basic

    @_authorize(@credentials)
    .then (c) -> client = c
    .then => @_request(client, { url: worksheetUrl })
    .then @_parseXml.bind(@)
    .then (data) ->
      worksheetUrls = data.feed.entry.map (i) -> i.id[0]
      url = worksheetUrls[0]
      throw new Error() if url.indexOf(worksheetUrl) isnt 0
      url.replace(worksheetUrl + '/', '')
    .then (worksheetId) =>
      cellsUrl = @_getCellsUrl
        key: @spreadsheetKey
        worksheetId: worksheetId
        visibilities: GoogleSheet.visibilities.private
        projections: GoogleSheet.projections.basic
      @_request(client, { url: cellsUrl })
    .then @_parseXml.bind(@)
    .then (data) ->
      data.feed.entry.map (i) ->
        { title: i.title[0]._, content: i.content[0]._ }

  _authorize: ({ email, key })->
    new Promise (resolve, reject) ->
      scope = ['https://spreadsheets.google.com/feeds']
      jwt = new google.auth.JWT(email, null, key, scope, null)
      jwt.authorize (err) ->
        if err? then reject(err) else resolve(jwt)

  _request: (client, options) ->
    new Promise (resolve, reject) ->
      client.request options, (err, data) ->
        if err? then reject(err) else resolve(data)

  _parseXml: (xml) ->
    new Promise (resolve, reject) ->
      parseString xml, (err, parsed) ->
        if err? then reject(err) else resolve(parsed)

  _listSpreadsheetsUrl: (client) ->
    baseUrl = 'https://spreadsheets.google.com/feeds'
    visibilities = GoogleSheet.visibilities.private
    projections = GoogleSheet.projections.full
    "#{baseUrl}/spreadsheets/#{visibilities}/#{projections}"

  # visibilities: private / public
  # projections: full / basic
  _getWorksheetUrl: ({ key, visibilities, projections }) ->
    baseUrl = 'https://spreadsheets.google.com/feeds'
    "#{baseUrl}/worksheets/#{key}/#{visibilities}/#{projections}"

  # visibilities: private / public
  # projections: full / basic
  _getCellsUrl: ({ key, worksheetId, visibilities, projections }) ->
    baseUrl = 'https://spreadsheets.google.com/feeds'
    "#{baseUrl}/cells/#{key}/#{worksheetId}/#{visibilities}/#{projections}"

  _getWorksheetId: ({ key, visibilities, projections }) ->
    baseUrl = 'https://spreadsheets.google.com/feeds'
    "#{baseUrl}/worksheets/#{key}/#{visibilities}/#{projections}"


module.exports = (config) ->
  new GoogleSheet(config).load()
