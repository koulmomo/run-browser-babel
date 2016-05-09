'use strict';

var http = require('http');
var fs = require('fs');
var inspect = require('util').inspect;
var path = require('path');
var browserify = require('browserify');
var glob = require('glob');
var istanbulTransform = require('browserify-babel-istanbul');
var JSONStream = require('jsonstream2');
var istanbul = require('istanbul');

var runPhantom = require('./lib/run-phantom.js')
var html = fs.readFileSync(__dirname + '/lib/test-page.html', 'utf8');

module.exports = createServer;
module.exports.runPhantom = runPhantom;
module.exports.createHandler = createHandler;
module.exports.handles = handles;

function createServer(filename, reports, phantom, browserifyOpts) {
  var handler = createHandler(filename, reports, phantom, browserifyOpts);
  return http.createServer(handler);
}

function instrumentTransform() {
  return istanbulTransform({
    ignore: [
      '**/node_modules/**',
      '**/test/**',
      '**/tests/**',
      '**/run-browser-babel/**'
    ],
    defaultIgnore: true
  });
}

function handleError(err, res) {
  var e = JSON.stringify(err.toString());
  res.end('document.getElementById("__testling_output").textContent = ' +
    e + ';console.error(' + e + ');');
  if (err) console.error(err.stack || err.message || err);
}

var BROWSERIFY_ERROR_MESSAGE_PREFIX = 'Invalid browserify options: ';
var BROWSERIFY_ARRAY_PROPS = ['transforms', 'plugins', 'externals'];
function checkBrowserifyOptsError(opts) {
  if (!opts) {
    return new Error(BROWSERIFY_ERROR_MESSAGE_PREFIX + 'expected options to be truthy.');
  }

  if (!BROWSERIFY_ARRAY_PROPS.map(function eachArrayProp(prop) {
    return opts[prop];
  }).every(Array.isArray)) {
    return new Error(BROWSERIFY_ERROR_MESSAGE_PREFIX + 'expected ' + BROWSERIFY_ARRAY_PROPS.map(function eachProp(prop){
      return '"opts.' + prop + '"';
    }).join(',') +' to be arrays, but instead got: ' + JSON.stringify(opts));
  }
}

function createHandler(filename, reports, phantom, browserifyOpts) {
  var browserifyOptsError = checkBrowserifyOptsError(browserifyOpts);
  if (browserifyOptsError) {
    return browserifyOptsError;
  }

  if (typeof reports === 'boolean' && reports) reports = [ 'text' ];
  else if (typeof reports === 'string') reports = [ reports ];

  if (reports && !Array.isArray(reports)) return new Error('Invalid reports type' + reports);

  return function (req, res) {
    if (req.url === '/') {
      res.setHeader('Content-Type', 'text/html');
      return res.end(html);
    }
    if ('/tests-bundle.js' === req.url) {
      var sent = false;
      res.setHeader('Content-Type', 'application/javascript');
      return glob(filename, function (err, files) {
        if (err || files.length === 0) {
          err = err || new Error('No files found matching ' + inspect(filename));
          return handleError(err, res);
        }
        files = files.map(normalizePath);
        files.unshift(path.join(__dirname, '/lib/override-log.js'));

        if (phantom) {
          files.unshift(path.join(__dirname, '/lib/phantom-function-bind-shim.js'));
        }

        var b = browserify(files, {debug: true});

        browserifyOpts.externals.forEach(function eachExternal(external) {
          b.external(external, {debug: true});
        });

        if (reports) b.transform(instrumentTransform());

        browserifyOpts.transforms.forEach(function eachTransform(transform) {
          b.transform(transform);
        });

        browserifyOpts.plugins.forEach(function eachPlugin(plugin) {
          b.plugin(plugin);
        });

        return b.bundle(onBrowserifySrc)

        function onBrowserifySrc(err, src) {
          if (sent) return;
          sent = true;
          return err ? handleError(err, res) : res.end(src);
        }

        function normalizePath(p) {
          return path.resolve(p);
        }
      });
    }
    if ('/results' === req.url && req.method === 'POST') {
      return req.pipe(JSONStream.parse('*')).once('data', function (results) {

        if (results.coverage) {
          var collector = new istanbul.Collector();
          var reporter = new istanbul.Reporter();
          var sync = false;
          collector.add(results.coverage);
          reporter.addAll(reports);
          reporter.write(collector, sync, done);
        }
        else {
          done();
        }

        function done(err) {
          res.statusCode === 200;
          res.end('OK');
          var passed = results.tap.fail.length === 0;
          if (phantom) process.exit(passed ? 0 : 1);
        }
      })
    }
    res.statusCode = 404;
    res.end('404: Path not found');
  }
}

function handles(req) {
  return req.url === '/' || req.url === '/tests-bundle.js';
}
