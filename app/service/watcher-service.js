/*
 * Background helper of the My Home TV app: makes My Home behave like the TV's hub.
 * The TV pauses the My Home page while another app is on screen, so this service does
 * the watching: whenever none of the known apps is on screen (an app was closed, the TV
 * fell back to live TV...), it puts My Home back in front. The My Home page tells it
 * what is going on (see helper-rules.js). The TV's own service says which app is on
 * screen, and only for apps known by their store number.
 * Only when My Home asks for it (config.helperStatusPage), it also answers on STATUS_PORT
 * with its recent log, to check from a computer on the home network that it runs.
 */
'use strict';

var http = require('http');
var os = require('os');
var rules = require('../helper-rules.js');

var HOME_ID = 'MyHomeTv01.MyHome';
var TV_PORT = 8001;
var STATUS_PORT = 8765;
var CHECK_MS = 1000;
var REPLY_TIMEOUT_MS = 3000;
var OPEN_GRACE_MS = 12000; // an opened app gets this long to appear
var RETRY_HOME_MS = 6000; // after opening My Home, wait before trying again
var MAX_LOG_LINES = 60;

var log = [];
var timer = null;
var state = { homeFront: true, paused: false, stopped: false, graceUntil: 0 };
var known = [];
var lastSeen = '';
var scanning = false;
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

var workingHost = '';

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

/** done(error, visible): asks the TV address that worked last, then the others. */
function isVisible(appId, done) {
  var hosts = (workingHost ? [workingHost] : []).concat(
    tvHosts().filter(function (host) {
      return host !== workingHost;
    })
  );
  function tryHost(index, lastError) {
    if (index >= hosts.length) {
      done(lastError || new Error('no TV address'));
      return;
    }
    askHost(hosts[index], appId, function (error, visible) {
      if (error) {
        tryHost(index + 1, error);
      } else {
        workingHost = hosts[index];
        done(null, visible);
      }
    });
  }
  tryHost(0, null);
}

function goHome() {
  note('no known app on screen: opening My Home');
  state = { homeFront: false, paused: state.paused, stopped: state.stopped, graceUntil: Date.now() + RETRY_HOME_MS };
  try {
    tizen.application.launch(
      HOME_ID,
      function () {},
      function (error) {
        note('could not open My Home: ' + (error && error.message));
      }
    );
  } catch (error) {
    note('could not open My Home: ' + error.message);
  }
}

// Looks for a known app on screen, starting with the one seen last. `failed`: a check
// did not get an answer, so nothing can be concluded.
function scan(ids, index, failed) {
  if (index >= ids.length) {
    scanning = false;
    if (!failed && rules.shouldScan(state, Date.now())) {
      goHome();
    }
    return;
  }
  isVisible(ids[index], function (error, visible) {
    if (!error && visible) {
      if (lastSeen !== ids[index]) {
        note(ids[index] + ' is on screen');
      }
      lastSeen = ids[index];
      scanning = false;
      return;
    }
    if (error) {
      note('check failed: ' + error.message);
    }
    scan(ids, index + 1, failed || Boolean(error));
  });
}

function check() {
  if (scanning || known.length === 0 || !rules.shouldScan(state, Date.now())) {
    return;
  }
  scanning = true;
  var ids = (lastSeen ? [lastSeen] : []).concat(
    known.filter(function (id) {
      return id !== lastSeen;
    })
  );
  scan(ids, 0, false);
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
      response.end(JSON.stringify({ state: state, known: known.length, lastSeen: lastSeen, log: log }));
    });
    statusServer.on('error', function (error) {
      note('status page unavailable: ' + error.message);
    });
    statusServer.listen(STATUS_PORT);
  } catch (error) {
    note('status page unavailable: ' + error.message);
  }
}

function handleRequest(data) {
  if (valuesOf(data, 'status')[0] === 'on') {
    startStatusServer();
  }
  var ids = valuesOf(data, 'known').filter(function (id) {
    return /^[0-9]+$/.test(id);
  });
  if (ids.length > 0) {
    known = ids;
  }
  var message = valuesOf(data, 'cmd')[0] || '';
  var openedId = valuesOf(data, 'id')[0] || '';
  var opened = /^[0-9]+$/.test(openedId) ? openedId : '';
  if (message === 'opened' && opened) {
    lastSeen = opened;
  }
  state = rules.applyMessage(state, message, Date.now(), OPEN_GRACE_MS);
  note(message + (opened ? ' ' + opened : ''));
}

module.exports.onStart = function () {
  note('helper started');
  if (!timer) {
    timer = setInterval(check, CHECK_MS);
  }
};

module.exports.onRequest = function () {
  try {
    var requested = tizen.application.getCurrentApplication().getRequestedAppControl();
    handleRequest((requested && requested.appControl && requested.appControl.data) || []);
  } catch (error) {
    note('bad request: ' + error.message);
  }
};

function shutDown() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports.onStop = shutDown;
module.exports.onExit = shutDown;
