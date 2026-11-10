/* Bridge to the Samsung TV (Tizen). On a computer it runs in preview mode. */
(function (root) {
  'use strict';

  var MAIN_WINDOW = 'MAIN';
  var TV_ANSWER_TIMEOUT_MS = 5000;
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
  function askTv(start) {
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) {
          settled = true;
          reject(new Error(NO_ANSWER));
        }
      }, TV_ANSWER_TIMEOUT_MS);

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
      return Promise.resolve(previewApps(catalog));
    }
    return askTv(function (resolve, reject) {
      api.application.getAppsInfo(resolve, reject);
    });
  }

  /** Resolves with { preview: true } on a computer, { preview: false } once the TV accepted the launch. */
  function launchApp(appId) {
    var api = tizenApi();
    if (!api) {
      return Promise.resolve({ preview: true });
    }
    return askTv(function (resolve, reject) {
      api.application.launch(
        appId,
        function () {
          resolve({ preview: false });
        },
        reject
      );
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
   * EXPERIMENTAL, not yet checked on a real TV: shows an HDMI input full screen
   * behind the page. Rejects with a readable Error when the TV does not allow it.
   */
  function showSource(wanted) {
    var api = tizenApi();
    if (!api) {
      return Promise.resolve({ preview: true });
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
    onTv: onTv,
    looksLikeTv: looksLikeTv,
    envInfo: envInfo,
    listInstalled: listInstalled,
    launchApp: launchApp,
    showSource: showSource,
    hideSource: hideSource
  };
})(typeof window !== 'undefined' ? window : this);
