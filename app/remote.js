/*
 * Talks to the TV's remote-control service (the one phone remote apps use) over a
 * WebSocket on port 8001. The first time, the TV asks whether to allow "My Home";
 * the token it gives back is kept so it does not ask again.
 */
(function (root) {
  'use strict';

  var PORT = 8001;
  var CLIENT_NAME = 'My Home';
  var TOKEN_KEY = 'myhome.remoteToken';
  var CONNECT_TIMEOUT_MS = 30000; // time for the person to press Allow on the TV
  var REPLY_TIMEOUT_MS = 8000;
  var LAUNCH_REPLY_WAIT_MS = 2500;

  var ready = null; // Promise of an open, authorised socket
  var listeners = [];

  // Tokens are stored per address and only ever sent back to the address that issued them,
  // so a token never reaches another device that later takes over a fallback address.
  function tokenKey(host) {
    return TOKEN_KEY + '@' + host;
  }

  function readToken(host) {
    try {
      return root.localStorage.getItem(tokenKey(host)) || '';
    } catch (error) {
      return '';
    }
  }

  function saveToken(host, token) {
    if (typeof token !== 'string' || token === '') {
      return;
    }
    try {
      root.localStorage.setItem(tokenKey(host), token);
    } catch (error) {
      console.error('Could not save the TV token', error);
    }
  }

  function parse(text) {
    try {
      var message = JSON.parse(text);
      return message && typeof message === 'object' ? message : null;
    } catch (error) {
      return null;
    }
  }

  function urlFor(host) {
    var url =
      'ws://' + host + ':' + PORT + '/api/v2/channels/samsung.remote.control?name=' +
      encodeURIComponent(root.btoa(CLIENT_NAME));
    var token = readToken(host);
    return token ? url + '&token=' + encodeURIComponent(token) : url;
  }

  function dispatch(message) {
    listeners.slice().forEach(function (listener) {
      listener(message);
    });
  }

  function connectTo(host) {
    return new Promise(function (resolve, reject) {
      var socket;
      var settled = false;
      try {
        socket = new root.WebSocket(urlFor(host));
      } catch (error) {
        reject(error);
        return;
      }
      var timer = setTimeout(function () {
        finish(new Error(host + ': no answer (was the Allow prompt accepted?)'));
      }, CONNECT_TIMEOUT_MS);

      function finish(error) {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        if (error) {
          try {
            socket.close();
          } catch (ignored) {
            // already closed
          }
          reject(error);
          return;
        }
        socket.onmessage = function (event) {
          var message = parse(event.data);
          if (message) {
            dispatch(message);
          }
        };
        socket.onclose = function () {
          ready = null;
        };
        resolve(socket);
      }

      socket.onmessage = function (event) {
        var message = parse(event.data);
        if (!message) {
          return;
        }
        if (message.event === 'ms.channel.connect') {
          saveToken(host, message.data && message.data.token);
          finish(null);
        } else if (message.event === 'ms.channel.unauthorized') {
          finish(new Error(host + ': the TV refused (choose Allow when it asks)'));
        }
      };
      socket.onerror = function () {
        finish(new Error(host + ': could not connect'));
      };
      socket.onclose = function () {
        finish(new Error(host + ': connection closed'));
      };
    });
  }

  /** Connects to the first address that works, reusing an open connection. */
  function connect(hosts) {
    if (ready) {
      return ready;
    }
    var failures = [];

    function tryHost(index) {
      if (index >= hosts.length) {
        return Promise.reject(new Error(failures.join('; ') || 'no TV address'));
      }
      return connectTo(hosts[index]).catch(function (error) {
        failures.push(error.message);
        return tryHost(index + 1);
      });
    }

    ready = tryHost(0).catch(function (error) {
      ready = null;
      throw error;
    });
    return ready;
  }

  function send(hosts, payload) {
    return connect(hosts).then(function (socket) {
      socket.send(JSON.stringify(payload));
      return socket;
    });
  }

  /** Resolves with the next message for `eventName`, or with null after `timeoutMs`. */
  function waitFor(eventName, timeoutMs) {
    return new Promise(function (resolve) {
      var timer = setTimeout(function () {
        remove();
        resolve(null);
      }, timeoutMs);
      function listener(message) {
        if (message.event === eventName) {
          clearTimeout(timer);
          remove();
          resolve(message);
        }
      }
      function remove() {
        listeners = listeners.filter(function (item) {
          return item !== listener;
        });
      }
      listeners = listeners.concat([listener]);
    });
  }

  function emit(event, data) {
    var params = { event: event, to: 'host' };
    if (data) {
      params.data = data;
    }
    return { method: 'ms.channel.emit', params: params };
  }

  /** Opens an installed app. Rejects if the TV answers with an error. */
  function launch(hosts, appId) {
    var reply = waitFor('ed.apps.launch', LAUNCH_REPLY_WAIT_MS);
    return send(hosts, emit('ed.apps.launch', { appId: appId, action_type: 'DEEP_LINK' }))
      .then(function () {
        return reply;
      })
      .then(function (message) {
        // No reply is not an error: some TVs open the app without answering.
        if (message && message.data !== 200 && message.data !== '200') {
          throw new Error('TV answered ' + JSON.stringify(message.data));
        }
      });
  }

  /** The TV's installed apps as { id, name, iconPath, show }. */
  function installedApps(hosts) {
    var reply = waitFor('ed.installedApp.get', REPLY_TIMEOUT_MS);
    return send(hosts, emit('ed.installedApp.get'))
      .then(function () {
        return reply;
      })
      .then(function (message) {
        var list = message && message.data && message.data.data;
        if (!Array.isArray(list)) {
          throw new Error('the TV did not send its app list');
        }
        return list.map(function (app) {
          return {
            id: app && app.appId,
            name: app && app.name,
            iconPath: (app && app.icon) || '',
            show: true
          };
        });
      });
  }

  /** Presses a remote-control key such as KEY_HDMI1. */
  function pressKey(hosts, key) {
    return send(hosts, {
      method: 'ms.remote.control',
      params: { Cmd: 'Click', DataOfCmd: key, Option: 'false', TypeOfRemote: 'SendRemoteKey' }
    }).then(function () {
      return undefined;
    });
  }

  root.Launcher = root.Launcher || {};
  root.Launcher.remote = {
    launch: launch,
    installedApps: installedApps,
    pressKey: pressKey
  };
})(typeof window !== 'undefined' ? window : this);
