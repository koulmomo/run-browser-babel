# run-browser-babel

The simplest way to run testling type tests in the browser. Supports babelified bundles.

[![Dependency Status](https://img.shields.io/gemnasium/rtsao/run-browser-babel.svg)](https://gemnasium.com/rtsao/run-browser-babel)
[![NPM version](https://img.shields.io/npm/v/run-browser-babel.svg)](http://badge.fury.io/js/run-browser-babel)

## Installation

    npm install run-browser-babel --save-dev


## Usage

    run-browser-babel <file> <options>

    Options:
      -p --port <number>                      The port number to run the server on (default: 3000)
      -b --phantom                            Use the phantom headless browser to run tests and then exit with the correct status code (if tests output TAP)
      -r --report                             Generate coverage Istanbul report. Repeat for each type of coverage report desired. (default: text only)
      -t --timeout                            Global timeout in milliseconds for tests to finish. (default: Infinity)

    Browserify Options:
      --bp --browserify-plugin <module>       Register <module> as a browserify plugin
      --bt --browserify-transform <transform> Use a transform module on top-level files
      --bx --browserify-external <module>     Reference a file from another bundle. Files can be globs

    Example:
      run-browser-babel test-file.js --port 3030 --report text --report html --report=cobertura --browserify-plugin proxyquireify/plugin

## API Usage

Basic usage:

```js
var runBrowser = require('run-browser-babel');

var server = runBrowser('tests/test.js');
server.listen(3000);
```

Advanced Usage:

```js
var runBrowser = require('run-browser-babel');

var handler = runBrowser.createHandler('tests/test.js');
var server = http.createServer(function (req, res) {
  if (runBrowser.handles(req)) {
    return handler(req, res);
  }
  // any other server logic here
});
server.listen(3000);
```

For advanced phantomjs usage, just read the source in `./bin/cli.js`

## License

  MIT
