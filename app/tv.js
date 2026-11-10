/* Bridge to the Samsung TV (Tizen). On a computer it runs in preview mode. */
(function (root) {
  'use strict';

  var MAIN_WINDOW = 'MAIN';
  var TV_ANSWER_TIMEOUT_MS = 5000;
  var LAUNCH_ANSWER_TIMEOUT_MS = 20000; // a cold app can take a while before the TV answers
  var NO_ANSWER = 'The TV did not answer in time.';

  /** Reads `getter()`, returning undefined if the browser refuses (cross-origin frames). */
  function safely(getter) {
    try {
      return getter();
    } catch (error) {
      return undefined;
    }
  }

  /**
   * The TV's `tizen` object. Inside TizenBrew the page may sit in a frame, so the
   * parent and top windows are checked too. Returns null when none has it.
   */
  function tizenApi() {
    var windows = [
      root,
      safely(function () {
        return root.parent;
      }),
      safely(function () {
        return root.top;
      })
    ];
    for (var i = 0; i < windows.length; i += 1) {
      var found = safely(function () {
        return windows[i] && windows[i].tizen && windows[i].tizen.application ? windows[i].tizen : null;
      });
      if (found) {
        return found;
      }
    }
    return null;
  }

  function onTv() {
    return tizenApi() !== null;
  }

  /** True when the browser says it is a Samsung TV, even if the TV functions are missing. */
  function looksLikeTv() {
    return /Tizen|SMART-TV|Samsung/i.test(String(root.navigator && root.navigator.userAgent));
  }

  /** A short text describing what the page can see, to help find why the TV functions are missing. */
  function envInfo() {
    var tizenKeys = safely(function () {
      return root.tizen ? Object.keys(root.tizen).slice(0, 10).join(',') : '';
    });
    var inFrame = safely(function () {
      return root.parent !== root;
    });
    var agent = String(root.navigator && root.navigator.userAgent).match(/Tizen [0-9.]+|Chrome\/[0-9.]+/g);
    return [
      'tizen=' + typeof root.tizen + (tizenKeys ? '(' + tizenKeys + ')' : ''),
      'webapis=' + typeof root.webapis,
      'frame=' + (inFrame ? 'yes' : 'no'),
      'parent.tizen=' +
        typeof safely(function () {
          return root.parent.tizen;
        }),
      'url=' + String(root.location && root.location.href).slice(0, 60),
      'ua=' + (agent ? agent.join(' ') : '?')
    ].join(' | ');
  }

  /**
   * Runs `start(resolve, reject)` as a promise that also rejects if the TV
   * never calls back. Late or repeated callbacks are ignored.
   */
  function askTv(start, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          reject(new Error(NO_ANSWER));
        }
      }, timeoutMs || TV_ANSWER_TIMEOUT_MS);

      function once(finish) {
        return function (value) {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          finish(value);
        };
      }

      try {
        start(once(resolve), once(reject));
      } catch (error) {
        once(reject)(error);
      }
    });
  }

  /** Stand-in app list for the computer preview: every catalog app, as if installed. */
  function previewApps(catalog) {
    return catalog.map(function (entry) {
      return { id: 'preview.' + entry.key, name: entry.label, iconPath: '', show: true };
    });
  }

  /** Resolves with the TV's raw installed-app list (unvalidated). */
  function listInstalled(catalog) {
    var api = tizenApi();
    if (!api) {
      // On a real TV without the tizen functions (inside TizenBrew), return no list so the
      // catalog's real app ids are used. Fake "preview." ids are only for the computer.
      return Promise.resolve(looksLikeTv() ? [] : previewApps(catalog));
    }
    return askTv(function (resolve, reject) {
      api.application.getAppsInfo(resolve, reject);
    });
  }

  function controlHosts() {
    var config = root.Launcher && root.Launcher.config;
    return (config && config.controlHosts) || ['127.0.0.1'];
  }

  var CONTROL_PORT = 8001;
  var discoveredIp = null;

  /** fetch that rejects on a non-2xx answer or when the TV does not answer in time. */
  function request(url, options, timeoutMs) {
    return askTv(function (resolve, reject) {
      root.fetch(url, options).then(function (response) {
        if (response.ok) {
          resolve(response);
        } else {
          reject(new Error('HTTP ' + response.status));
        }
      }, reject);
    }, timeoutMs);
  }

  function baseUrl(host) {
    return 'http://' + host + ':' + CONTROL_PORT;
  }

  /**
   * Asks each configured address for the TV's device info and remembers the TV's real
   * network address (the internal 127.0.0.1 address may answer without acting).
   */
  function discoverTvIp() {
    if (discoveredIp) {
      return Promise.resolve(discoveredIp);
    }
    var hosts = controlHosts();

    function tryHost(index) {
      if (index >= hosts.length) {
        return Promise.resolve(null);
      }
      return request(baseUrl(hosts[index]) + '/api/v2/', { method: 'GET' })
        .then(function (response) {
          return response.json();
        })
        .then(function (info) {
          var ip = info && info.device && info.device.ip;
          if (typeof ip === 'string' && /^[0-9.]+$/.test(ip)) {
            discoveredIp = ip;
            return ip;
          }
          return tryHost(index + 1);
        })
        .catch(function () {
          return tryHost(index + 1);
        });
    }

    return tryHost(0);
  }

  function uniqueHosts(first) {
    var all = (first ? [first] : []).concat(controlHosts());
    return all.filter(function (host, index) {
      return all.indexOf(host) === index;
    });
  }

  /** Addresses for the remote-control service: the TV's real address first. */
  function remoteHosts() {
    return discoverTvIp().then(uniqueHosts);
  }

  /** The TV's real installed-app list, read through the remote-control service. */
  function installedOverRemote() {
    return remoteHosts().then(function (hosts) {
      return root.Launcher.remote.installedApps(hosts);
    });
  }

  /**
   * Opens an app through the TV's own network service (port 8001), which is how the
   * launcher works inside TizenBrew where the `tizen` functions do not exist.
   * Uses the TV's real network address first, then the configured ones, and only
   * counts a launch as done when the TV answers OK. Resolves with the address used.
   */
  function launchOverNetwork(appId) {
    return discoverTvIp().then(function (ip) {
      var hosts = uniqueHosts(ip);
      var failures = [];

      function tryHost(index) {
        if (index >= hosts.length) {
          return Promise.reject(new Error('TV did not accept the launch: ' + failures.join('; ')));
        }
        var url = baseUrl(hosts[index]) + '/api/v2/applications/' + encodeURIComponent(appId);
        // The TV's real address gets the long wait; the others are quick fallbacks.
        var wait = hosts[index] === ip ? LAUNCH_ANSWER_TIMEOUT_MS : TV_ANSWER_TIMEOUT_MS;
        return request(url, { method: 'POST' }, wait)
          .then(function () {
            return hosts[index];
          })
          .catch(function (error) {
            failures.push(hosts[index] + ' ' + ((error && error.message) || 'failed'));
            return tryHost(index + 1);
          });
      }

      return tryHost(0);
    });
  }

  var LAUNCH_TYPES = ['DEEP_LINK', 'NATIVE_LAUNCH'];
  var restRefused = false; // the TV refused the quick route once: do not wait on it again

  /**
   * Opens an app through the remote-control service, trying each launch type until the
   * TV confirms. Resolves { confirmed, trace }; rejects when every type is refused.
   */
  function launchOverRemote(appId, onStep) {
    return remoteHosts().then(function (hosts) {
      var remote = root.Launcher.remote;
      var trace = [];
      if (!remote.hasToken(hosts)) {
        onStep('Look at the TV: choose Allow if it asks about "My Home"');
      }

      function tryType(index) {
        if (index >= LAUNCH_TYPES.length) {
          return Promise.resolve({ confirmed: false, trace: trace });
        }
        var type = LAUNCH_TYPES[index];
        return remote.launch(hosts, appId, type).then(
          function (result) {
            trace.push(type + ': ' + (result.answered ? 'OK' : 'no answer'));
            return result.answered ? { confirmed: true, trace: trace } : tryType(index + 1);
          },
          function (error) {
            trace.push(type + ': ' + ((error && error.message) || 'failed'));
            return tryType(index + 1);
          }
        );
      }

      return tryType(0);
    });
  }

  /**
   * Resolves { preview: true } on a computer. On the TV resolves { preview: false,
   * confirmed, trace }: `confirmed` is false when the TV never said the app opened.
   * `onStep(text)` reports progress for the screen.
   */
  function launchApp(appId, onStep) {
    var step = typeof onStep === 'function' ? onStep : function () {};
    var api = tizenApi();
    if (!api) {
      if (!looksLikeTv()) {
        return Promise.resolve({ preview: true });
      }
      // The TV may refuse the quick route (HTTP 401 from its own browser); then use the
      // remote-control service, which asks the person to allow "My Home" once.
      var quick = restRefused
        ? Promise.reject(new Error('quick route refused earlier'))
        : launchOverNetwork(appId);
      return quick
        .then(function (host) {
          return { preview: false, confirmed: true, trace: ['quick route OK at ' + host] };
        })
        .catch(function (restError) {
          restRefused = true;
          return launchOverRemote(appId, step).then(
            function (result) {
              return { preview: false, confirmed: result.confirmed, trace: result.trace };
            },
            function (remoteError) {
              throw new Error(restError.message + ' / remote: ' + remoteError.message);
            }
          );
        });
    }
    return askTv(function (resolve, reject) {
      function opened() {
        resolve({ preview: false, confirmed: true, trace: [] });
      }
      function plainLaunch() {
        api.application.launch(appId, opened, reject);
      }
      // Opened as a "child" of My Home, the TV comes back to My Home when the app closes
      // instead of dropping to the last TV channel. If the TV refuses, open it normally.
      try {
        var control = new root.tizen.ApplicationControl(
          'http://tizen.org/appcontrol/operation/default', null, null, null, [], 'GROUP'
        );
        api.application.launchAppControl(control, appId, opened, plainLaunch);
      } catch (error) {
        plainLaunch();
      }
    });
  }

  /** What the TV says about an app, as short text: "running, not on screen"... */
  function appStatus(appId) {
    return discoverTvIp()
      .then(function (ip) {
        var host = ip || controlHosts()[0];
        return request(baseUrl(host) + '/api/v2/applications/' + encodeURIComponent(appId), { method: 'GET' });
      })
      .then(function (response) {
        return response.json();
      })
      .then(function (info) {
        return (info.running ? 'running' : 'not running') + ', ' + (info.visible ? 'on screen' : 'not on screen');
      })
      .catch(function (error) {
        return 'status unknown (' + ((error && error.message) || 'failed') + ')';
      });
  }

  /** True when the TV says this app is the one on screen. */
  function appVisible(appId) {
    return discoverTvIp()
      .then(function (ip) {
        var host = ip || controlHosts()[0];
        return request(baseUrl(host) + '/api/v2/applications/' + encodeURIComponent(appId), { method: 'GET' });
      })
      .then(function (response) {
        return response.json();
      })
      .then(function (info) {
        return Boolean(info && info.visible);
      });
  }

  var WATCHER_SERVICE_ID = 'MyHomeTv01.Watcher';

  /**
   * As a real TV app: sends a message to the background helper (see helper-rules.js).
   * `options`: { id, known, statusPage }.
   */
  function tellHelper(message, options) {
    var api = tizenApi();
    if (!api || !root.tizen || !root.tizen.ApplicationControl) {
      return Promise.reject(new Error('not installed as a TV app'));
    }
    var settings = options || {};
    return askTv(function (resolve, reject) {
      var Data = root.tizen.ApplicationControlData;
      var control = new root.tizen.ApplicationControl('http://tizen.org/appcontrol/operation/service', null, null, null, [
        new Data('cmd', [message]),
        new Data('id', [settings.id || '-']),
        new Data('known', settings.known && settings.known.length ? settings.known : ['-']),
        new Data('status', [settings.statusPage ? 'on' : 'off'])
      ]);
      api.application.launchAppControl(control, WATCHER_SERVICE_ID, resolve, reject);
    });
  }

  /** As a real TV app: puts My Home back on screen. */
  function bringToFront() {
    var api = tizenApi();
    if (!api) {
      return Promise.reject(new Error('not installed as a TV app'));
    }
    return askTv(function (resolve, reject) {
      api.application.launch(api.application.getCurrentApplication().appInfo.id, resolve, reject);
    });
  }

  /** As a real TV app: asks the TV to send these extra remote keys to the page. */
  function registerKeys(names) {
    var api = tizenApi();
    if (!api || !api.tvinputdevice) {
      return;
    }
    names.forEach(function (name) {
      try {
        api.tvinputdevice.registerKey(name);
      } catch (error) {
        console.error('Could not register the remote key', name, error);
      }
    });
  }

  function findSource(videoSources, wanted) {
    var connected = (videoSources && videoSources.connected) || [];
    for (var i = 0; i < connected.length; i += 1) {
      if (connected[i].type === wanted.type && connected[i].number === wanted.number) {
        return connected[i];
      }
    }
    return null;
  }

  function fullScreen() {
    return ['0px', '0px', root.innerWidth + 'px', root.innerHeight + 'px'];
  }

  /**
   * As a real TV app: which of `sources` have something plugged in. Resolves with the
   * connected ones; with all of them when the TV cannot tell (computer, TizenBrew).
   */
  function connectedSources(sources) {
    var api = tizenApi();
    if (!api || !api.systeminfo) {
      return Promise.resolve(sources);
    }
    return askTv(function (resolve, reject) {
      api.systeminfo.getPropertyValue(
        'VIDEOSOURCE',
        function (videoSources) {
          resolve(
            sources.filter(function (source) {
              return findSource(videoSources, source) !== null;
            })
          );
        },
        reject
      );
    });
  }

  /** As a real TV app: true when the TV's sound is muted. */
  function isMuted() {
    var api = tizenApi();
    try {
      return Boolean(api && api.tvaudiocontrol && api.tvaudiocontrol.isMute());
    } catch (error) {
      return false;
    }
  }

  /**
   * EXPERIMENTAL, not yet checked on a real TV: shows an HDMI input full screen
   * behind the page. Rejects with a readable Error when the TV does not allow it.
   */
  function showSource(wanted) {
    var api = tizenApi();
    if (!api) {
      if (!looksLikeTv()) {
        return Promise.resolve({ preview: true });
      }
      // Inside TizenBrew: press the TV's own HDMI key through the remote-control service.
      return remoteHosts()
        .then(function (hosts) {
          return root.Launcher.remote.pressKey(hosts, 'KEY_HDMI' + wanted.number);
        })
        .then(function () {
          return { preview: false, handledByTv: true };
        });
    }
    if (!api.tvwindow || !api.systeminfo) {
      return Promise.reject(new Error('This TV does not let apps switch inputs.'));
    }
    return askTv(function (resolve, reject) {
      api.systeminfo.getPropertyValue(
        'VIDEOSOURCE',
        function (videoSources) {
          var source = findSource(videoSources, wanted);
          if (!source) {
            reject(new Error('Nothing is connected to that input.'));
            return;
          }
          api.tvwindow.setSource(
            source,
            function () {
              api.tvwindow.show(
                function () {
                  resolve({ preview: false });
                },
                reject,
                fullScreen(),
                MAIN_WINDOW
              );
            },
            reject
          );
        },
        reject
      );
    });
  }

  /**
   * Presses one of the TV's own remote keys (KEY_POWER, KEY_MUTE...) through its
   * remote-control service. Resolves {preview:true} on a computer.
   */
  function pressTvKey(key) {
    var api = tizenApi();
    // As a real TV app, sound goes through the TV's own audio control.
    if (api && api.tvaudiocontrol && key === 'KEY_MUTE') {
      return new Promise(function (resolve) {
        api.tvaudiocontrol.setMute(!api.tvaudiocontrol.isMute());
        resolve({ preview: false });
      });
    }
    if (!looksLikeTv()) {
      return Promise.resolve({ preview: true });
    }
    return remoteHosts()
      .then(function (hosts) {
        return root.Launcher.remote.pressKey(hosts, key);
      })
      .then(function () {
        return { preview: false };
      });
  }

  function hideSource() {
    var api = tizenApi();
    if (!api || !api.tvwindow) {
      return Promise.resolve();
    }
    return askTv(function (resolve, reject) {
      api.tvwindow.hide(resolve, reject, MAIN_WINDOW);
    });
  }

  /**
   * Leaves the launcher: goes back to TizenBrew if the page was opened from it,
   * otherwise (or if nothing happens) closes the whole app.
   */
  function leaveApp() {
    var api = tizenApi();
    if (root.history && root.history.length > 1) {
      root.history.back();
    }
    setTimeout(function () {
      // Still here after going back: close the app instead.
      try {
        if (api) {
          api.application.getCurrentApplication().exit();
        } else if (root.close) {
          root.close();
        }
      } catch (error) {
        console.error('Could not close the app', error);
      }
    }, 600);
  }

  root.Launcher = root.Launcher || {};
  root.Launcher.tv = {
    leaveApp: leaveApp,
    pressTvKey: pressTvKey,
    onTv: onTv,
    looksLikeTv: looksLikeTv,
    installedOverRemote: installedOverRemote,
    envInfo: envInfo,
    listInstalled: listInstalled,
    launchApp: launchApp,
    connectedSources: connectedSources,
    isMuted: isMuted,
    appVisible: appVisible,
    bringToFront: bringToFront,
    tellHelper: tellHelper,
    registerKeys: registerKeys,
    appStatus: appStatus,
    showSource: showSource,
    hideSource: hideSource
  };
})(typeof window !== 'undefined' ? window : this);
