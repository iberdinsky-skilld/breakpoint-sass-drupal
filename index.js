'use strict'
var YAML = require('yamljs')
var fs = require('fs')
var stream = require('stream')
var through = require('through2')
var mediaQuery = require('css-mediaquery')

var breakpointSassFromDrupal = {}

function jsonToScssMap (obj, mapName) {
  var scssMap = '$' + (mapName ? mapName : '') + ': (\n'

  for (var i in obj) {
    var breakpoint = obj[i]
    var multipliers = getMultipliers(breakpoint)
    var label = ( mapName ? mapName + '--' : '' ) + breakpoint.label
    var query = queryToBreakpointSass(mediaQuery.parse(breakpoint.mediaQuery));

    if (multipliers) {
      for (var j in multipliers) {
        scssMap += '  ' + label + '__' + multipliers[j] + ': \'' + query + '\',\n'
      }
    } else {
      scssMap += '  ' + label + ': \'' + query + '\',\n'
    }
  }

  scssMap += ');'

  return scssMap
}

function queryToBreakpointSass(query) {
  var output = ''
  for (var i in query) {
    var part = query[i]
    var pairWidth = ['', '']
    var pairHeight = ['', '']
    output += (part.inverse ? 'not ' : '') + part.type

    for (var j in part.expressions) {
      var expression = part.expressions[j]
      var modifier = expression.modifier ? expression.modifier + '-' : ''
      var value = expression.value ? ' ' + expression.value : ''

      if (expression.feature == 'width') {

        if (expression.modifier == 'min') {
          pairWidth[0] = expression.value
        } else if (expression.modifier == 'max') {
          pairWidth[1] = expression.value
        }
        if (j == part.expressions.length - 1) {
          if (pairWidth[0] == '') {
            output += pairWidth[1] ? '(max-width ' + pairWidth[1] + ')' : ''
          } else {
            output += ' (' +  pairWidth.join(' ') + ')'
          }
        }

      } else if (expression.feature == 'height') {

        if (expression.modifier == 'min') {
          pairHeight[0] = expression.value
        } else if (expression.modifier == 'max') {
          pairHeight[1] = expression.value
        }
        if (j == part.expressions.length - 1) {

          if (pairHeight[0] == '') {
            output += pairHeight[1] ? '(max-height ' + pairHeight[1] + ')' : ''
          } else {
            output += ' (height ' +  pairHeight.join(' ') + ')'
          }
          console.log(output);
        }


      } else {

        output += ' (' + modifier + expression.feature + value + ')'

      }
    }

    if (i < query.length - 1) {
      output += ', '
    }
  }
  return output
}

/**
 * Returns array of groups in breakpoints object.
 * If breakpoint without group, then it will added to 'default' group.
 */
function getGroups(obj) {
  var groups = []
  var isEmptyExists = false // If breakpoint without group exist.
  for (var i in obj) {
    var breakpoint = obj[i]
    if (breakpoint.hasOwnProperty('group')) {
      if (groups.indexOf(breakpoint.group) === -1) {
        groups.push(breakpoint.group)
      }
    } else {
      isEmptyExists = true
    }
  }
  if (isEmptyExists) {
    groups.unshift('default') // Add default empty group.
  }
  return groups
}

/**
 * Returns list of queries for group.
 */
function getGroupQueries(obj, group) {
  var queries = []
  for (var i in obj) {
    var breakpoint = obj[i]

    if (breakpoint.hasOwnProperty('group')) {
      if (breakpoint.group == group) {
        queries.push(breakpoint)
      }
    } else if (group == 'default') {
      queries.push(breakpoint)
    }
  }
  return queries
}

/**
 * Get multipliers.
 */
function getMultipliers (breakpoint) {
  var multipliers = []
  if (breakpoint.hasOwnProperty('multipliers')) {
    for (var i in breakpoint.multipliers) {
      multipliers.push(breakpoint.multipliers[i])
    }
  } else {
    multipliers = false
  }
  return multipliers
}

function generateScss (breakpoints) {
  var groups = getGroups(breakpoints)
  var output = ''
  if (groups.length == 1) {
    output += jsonToScssMap(breakpoints) + '\n'
  } else {
    for (var i in groups) {
      var queries = getGroupQueries(breakpoints, groups[i])
      output += jsonToScssMap(queries, groups[i].replace('.', '-')) + '\n'
    }
  }

  return output
}

breakpointSassFromDrupal.read = function (path, opts = {}) {
  var rs = stream.Readable()
  var breakpoints = YAML.load(path)

  rs._read = function () {
    rs.push(generateScss(breakpoints, opts))
    rs.push(null)
  }

  return rs
}

breakpointSassFromDrupal.write = function (path) {
  var scssFile = fs.createWriteStream(path)
  return scssFile
}

breakpointSassFromDrupal.ymlToScss = function () {
  return through.obj(function (file, enc, cb) {
    var content = file.contents.toString('utf8')
    var breakpoints = YAML.parse(content)
    file.contents = new Buffer(String(generateScss(breakpoints)))
    cb(null, file)
  })
}

module.exports = breakpointSassFromDrupal
