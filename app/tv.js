/* Bridge to the Samsung TV (Tizen). On a computer it runs in preview mode. */
(function (root) {
  'use strict';

  var MAIN_WINDOW = 'MAIN';
  var TV_ANSWER_TIMEOUT_MS = 5000;
  var NO_ANSWER = 'The TV did not answer in time.';

  function onTv() {
    return typeof root.tizen !== 'undefined' && Boolean(root.tizen.application);
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
    if (!onTv()) {
      return Promise.resolve(previewApps(catalog));
    }
    return askTv(function (resolve, reject) {
      root.tizen.application.getAppsInfo(resolve, reject);
    });
  }

  /** Resolves with { preview: true } on a computer, { preview: false } once the TV accepted the launch. */
  function launchApp(appId) {
    if (!onTv()) {
      return Promise.resolve({ preview: true });
    }
    return askTv(function (resolve, reject) {
      root.tizen.application.launch(
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
    if (!onTv()) {
      return Promise.resolve({ preview: true });
    }
    if (!root.tizen.tvwindow || !root.tizen.systeminfo) {
      return Promise.reject(new Error('This TV does not let apps switch inputs.'));
    }
    return askTv(function (resolve, reject) {
      root.tizen.systeminfo.getPropertyValue(
        'VIDEOSOURCE',
        function (videoSources) {
          var source = findSource(videoSources, wanted);
          if (!source) {
            reject(new Error('Nothing is connected to that input.'));
            return;
          }
          root.tizen.tvwindow.setSource(
            source,
            function () {
              root.tizen.tvwindow.show(
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
    if (!onTv() || !root.tizen.tvwindow) {
      return Promise.resolve();
    }
    return askTv(function (resolve, reject) {
      root.tizen.tvwindow.hide(resolve, reject, MAIN_WINDOW);
    });
  }

  root.Launcher = root.Launcher || {};
  root.Launcher.tv = {
    onTv: onTv,
    listInstalled: listInstalled,
    launchApp: launchApp,
    showSource: showSource,
    hideSource: hideSource
  };
})(typeof window !== 'undefined' ? window : this);
