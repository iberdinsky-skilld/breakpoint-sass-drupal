'use strict'
var YAML = require('yamljs')
var fs = require('fs')
var stream = require('stream')
var through = require('through2')

var breakpointSassFromDrupal = {}

function jsonToScssMap (obj, mapName) {
  var scssMap = '$' + (mapName ? mapName : '') + ': (\n'

  for (var i in obj) {
    var breakpoint = obj[i]
    var multipliers = getMultipliers(breakpoint)
    var label = ( mapName ? mapName + '--' : '' ) + breakpoint.label
    if (multipliers) {
      for (var j in multipliers) {
        scssMap += '  ' + label + '__' + multipliers[j] + ': \'' + breakpoint.mediaQuery + '\',\n'
      }
    } else {
      scssMap += '  ' + label + ': \'' + breakpoint.mediaQuery + '\',\n'
    }
  }

  scssMap += ');'

  return scssMap
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
