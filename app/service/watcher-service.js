/*
 * Background helper of the My Home TV app. The TV pauses the My Home page while another
 * app is on screen, so this small service does the watching: when the app My Home opened
 * is no longer on screen (and no other known app is), it puts My Home back in front.
 * Only when My Home asks for it (config.helperStatusPage), it also answers on STATUS_PORT
 * with its recent log, to check from a computer on the home network that it runs.
 */
'use strict';

var http = require('http');
var os = require('os');
var decide = require('../watcher.js').decide;

var HOME_ID = 'MyHomeTv01.MyHome';
var TV_PORT = 8001;
var STATUS_PORT = 8765;
var CHECK_MS = 2500;
var REPLY_TIMEOUT_MS = 4000;
var MAX_LOG_LINES = 60;

var log = [];
var timer = null;
var followed = '';
var others = [];
var seen = false;
var checks = 0;
var statusServer = null;

function note(text) {
  log = log.concat([new Date().toISOString().slice(11, 19) + ' ' + text]).slice(-MAX_LOG_LINES);
}

/** The TV's own addresses: the internal one first, then its network ones. */
function tvHosts() {
  var found = ['127.0.0.1'];
  var interfaces = os.networkInterfaces();
  Object.keys(interfaces).forEach(function (name) {
    interfaces[name].forEach(function (entry) {
      if (entry.family === 'IPv4' && !entry.internal) {
        found = found.concat([entry.address]);
      }
    });
  });
  return found;
}

function askHost(host, appId, done) {
  var finished = false;
  function finish(error, visible) {
    if (!finished) {
      finished = true;
      done(error, visible);
    }
  }
  var request = http.get(
    { host: host, port: TV_PORT, path: '/api/v2/applications/' + encodeURIComponent(appId) },
    function (response) {
      var body = '';
      response.on('data', function (chunk) {
        body += chunk;
      });
      response.on('end', function () {
        try {
          finish(null, Boolean(JSON.parse(body).visible));
        } catch (error) {
          finish(error);
        }
      });
    }
  );
  request.setTimeout(REPLY_TIMEOUT_MS, function () {
    request.abort();
    finish(new Error('no answer from ' + host));
  });
  request.on('error', finish);
}

/** done(error, visible): asks each of the TV's addresses until one answers. */
function isVisible(appId, done) {
  var hosts = tvHosts();
  function tryHost(index, lastError) {
    if (index >= hosts.length) {
      done(lastError || new Error('no TV address'));
      return;
    }
    askHost(hosts[index], appId, function (error, visible) {
      if (error) {
        tryHost(index + 1, error);
      } else {
        done(null, visible);
      }
    });
  }
  tryHost(0, null);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function goHome() {
  stop();
  note('nothing known on screen: opening My Home');
  try {
    tizen.application.launch(
      HOME_ID,
      function () {
        note('My Home opened');
      },
      function (error) {
        note('could not open My Home: ' + (error && error.message));
      }
    );
  } catch (error) {
    note('could not open My Home: ' + error.message);
  }
}

// Another known app took over (opened from Samsung's bar): follow that one instead.
function lookAround(index) {
  if (index >= others.length) {
    goHome();
    return;
  }
  isVisible(others[index], function (error, visible) {
    if (!error && visible) {
      note('now following ' + others[index]);
      followed = others[index];
      return;
    }
    lookAround(index + 1);
  });
}

function check() {
  checks += 1;
  isVisible(followed, function (error, visible) {
    if (error) {
      note('check failed: ' + error.message);
      return;
    }
    if (visible && !seen) {
      note(followed + ' is on screen');
    }
    seen = seen || visible;
    var step = decide(seen, visible, checks);
    if (step === 'give-up') {
      note(followed + ' never appeared: stopped');
      stop();
    } else if (step === 'look-around') {
      note(followed + ' left the screen');
      lookAround(0);
    }
  });
}

function follow(appId, knownIds) {
  stop();
  followed = appId;
  others = knownIds.filter(function (id) {
    return id && id !== appId && id !== HOME_ID;
  });
  seen = false;
  checks = 0;
  note('following ' + appId + ' (' + others.length + ' other known apps)');
  timer = setInterval(check, CHECK_MS);
}

function valuesOf(data, key) {
  for (var i = 0; i < data.length; i += 1) {
    if (data[i].key === key) {
      return data[i].value || [];
    }
  }
  return [];
}

function startStatusServer() {
  if (statusServer) {
    return;
  }
  try {
    statusServer = http.createServer(function (request, response) {
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ following: timer ? followed : '', seen: seen, checks: checks, log: log }));
    });
    statusServer.on('error', function (error) {
      note('status page unavailable: ' + error.message);
    });
    statusServer.listen(STATUS_PORT);
  } catch (error) {
    note('status page unavailable: ' + error.message);
  }
}

module.exports.onStart = function () {
  note('helper started');
};

module.exports.onRequest = function () {
  try {
    var requested = tizen.application.getCurrentApplication().getRequestedAppControl();
    var data = (requested && requested.appControl && requested.appControl.data) || [];
    if (valuesOf(data, 'status')[0] === 'on') {
      startStatusServer();
    }
    var appId = valuesOf(data, 'follow')[0];
    if (appId) {
      follow(appId, valuesOf(data, 'known'));
    } else {
      note('request without an app to follow');
    }
  } catch (error) {
    note('bad request: ' + error.message);
  }
};

module.exports.onStop = function () {
  stop();
};

module.exports.onExit = function () {
  stop();
};
