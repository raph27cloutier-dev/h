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
var CHECK_MS = 100;
var EXIT_CHECK_MS = 60; // how often the list of running apps is read
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
// The app My Home opened last, by its own id, and whether it has been seen running.
var openedApp = '';
var openedSeenRunning = false;
var exitTimer = null;
var readingApps = false;
// True once the screen checks saw a known app other than the one My Home opened.
var switchedApp = false;

function note(text) {
  log = log.concat([new Date().toISOString().slice(11, 23) + ' ' + text]).slice(-MAX_LOG_LINES);
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
  launchHome();
}

// Puts My Home in front. Asked from this service, My Home is resumed, not reloaded.
function launchHome() {
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

// Asks about several apps at once. done(visibleId, failed): the first id found on screen
// (or ''), and whether a check got no answer, in which case nothing can be concluded.
function findVisible(ids, done) {
  var pending = ids.length;
  var found = '';
  var failed = false;
  if (pending === 0) {
    done('', false);
    return;
  }
  ids.forEach(function (id) {
    isVisible(id, function (error, visible) {
      if (error) {
        failed = true;
        note('check failed: ' + error.message);
      } else if (visible && !found) {
        found = id;
      }
      pending -= 1;
      if (pending === 0) {
        done(found, failed);
      }
    });
  });
}

function sawOnScreen(id) {
  if (lastSeen !== id) {
    note(id + ' is on screen');
    switchedApp = true;
  }
  lastSeen = id;
}

// Every tick: is the app seen last still on screen? Only when it is not are the other
// known apps checked, all at once, so coming back to My Home takes a fraction of a second.
// An app that was just opened gets time to appear. As soon as it is on screen the wait
// is over, so closing it right away still brings My Home back at once.
function endGraceWhenOnScreen() {
  var waiting = !state.homeFront && !state.paused && !state.stopped && Date.now() < state.graceUntil;
  if (!waiting || !lastSeen) {
    return;
  }
  scanning = true;
  isVisible(lastSeen, function (error, visible) {
    scanning = false;
    if (!error && visible && Date.now() < state.graceUntil) {
      note(lastSeen + ' is on screen');
      state = { homeFront: state.homeFront, paused: state.paused, stopped: state.stopped, graceUntil: 0 };
    }
  });
}

function check() {
  if (scanning || known.length === 0) {
    return;
  }
  if (!rules.shouldScan(state, Date.now())) {
    endGraceWhenOnScreen();
    return;
  }
  scanning = true;
  var others = known.filter(function (id) {
    return id !== lastSeen;
  });
  findVisible(lastSeen ? [lastSeen] : [], function (stillThere, failedFirst) {
    if (stillThere || failedFirst) {
      scanning = false;
      return;
    }
    if (lastSeen) {
      note(lastSeen + ' left the screen');
    }
    // The app My Home opened is covered (Samsung's Home bar) or gone: as the TV's hub,
    // My Home takes the screen at once instead of first looking for another app.
    if (!switchedApp) {
      scanning = false;
      goHome();
      return;
    }
    findVisible(others, function (other, failed) {
      scanning = false;
      if (other) {
        sawOnScreen(other);
      } else if (!failed && rules.shouldScan(state, Date.now())) {
        goHome();
      }
    });
  });
}

// Most apps really close when you leave them. The list of running apps shows that at
// once, for any app (no store number needed), so My Home can come back without waiting
// for the TV's own service to report the screen. Apps that keep running in the
// background (Netflix) are handled by the screen checks above.
function watchForExit() {
  if (!openedApp || readingApps || state.homeFront || state.stopped) {
    return;
  }
  readingApps = true;
  try {
    tizen.application.getAppsContext(
      function (contexts) {
        readingApps = false;
        var running = contexts.some(function (context) {
          return context.appId === openedApp;
        });
        if (running) {
          openedSeenRunning = true;
          return;
        }
        if (!openedSeenRunning || state.homeFront || state.stopped) {
          return;
        }
        note(openedApp + ' closed');
        openedApp = '';
        // The person stayed in the app My Home opened: go home at once. Only if the
        // screen checks saw another known app since (switched from Samsung's bar) is
        // the screen looked at first.
        if (!switchedApp) {
          state = { homeFront: false, paused: false, stopped: false, graceUntil: 0 };
          goHome();
          return;
        }
        findVisible(known, function (other) {
          if (other) {
            sawOnScreen(other);
          } else if (!state.homeFront && !state.stopped) {
            state = { homeFront: false, paused: false, stopped: false, graceUntil: 0 };
            goHome();
          }
        });
      },
      function () {
        readingApps = false;
      }
    );
  } catch (error) {
    readingApps = false;
  }
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
  var appId = valuesOf(data, 'app')[0] || '';
  if ((message === 'opened' || message === 'pause') && appId && appId !== '-') {
    openedApp = appId;
    openedSeenRunning = false;
    switchedApp = false;
  }
  if (message === 'front' || message === 'stop') {
    openedApp = '';
  }
  // Samsung's Home bar opened over My Home itself: come back in front of it.
  if (message === 'bar' && !state.stopped) {
    note('bar over My Home: coming back in front');
    launchHome();
    return;
  }
  state = rules.applyMessage(state, message, Date.now(), OPEN_GRACE_MS);
  note(message + (opened ? ' ' + opened : ''));
}

module.exports.onStart = function () {
  note('helper started');
  if (!timer) {
    timer = setInterval(check, CHECK_MS);
    exitTimer = setInterval(watchForExit, EXIT_CHECK_MS);
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
    clearInterval(exitTimer);
    timer = null;
    exitTimer = null;
  }
}

module.exports.onStop = shutDown;
module.exports.onExit = shutDown;
