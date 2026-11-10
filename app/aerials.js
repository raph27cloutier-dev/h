/*
 * Apple TV aerial screensaver videos, streamed from Apple's own servers (1080p, H.264).
 * Pure data and helpers, no DOM.
 */
(function (root) {
  'use strict';

  var BASE = 'http://a1.phobos.apple.com/us/r1000/000/Features/atv/AutumnResources/videos/';

  var FILES = [
    { place: 'Greenland', time: 'day', file: 'comp_GL_G004_C010_v03_6Mbps.mov' },
    { place: 'Dubai', time: 'night', file: 'comp_DB_D011_D009_SIGNCMP_v15_6Mbps.mov' },
    { place: 'Los Angeles', time: 'day', file: 'comp_LA_A005_C009_v05_t9_6M.mov' },
    { place: 'Hong Kong', time: 'night', file: 'comp_HK_B005_C011_t9_6M_tag0.mov' },
    { place: 'Hong Kong', time: 'day', file: 'comp_HK_H004_C008_v10_6Mbps.mov' },
    { place: 'Los Angeles', time: 'night', file: 'comp_LA_A009_C009_t9_6M_tag0.mov' },
    { place: 'China', time: 'day', file: 'comp_C002_C005_0818SC_001_v01_6M_HB_tag0.mov' },
    { place: 'Greenland', time: 'night', file: 'comp_GL_G010_C006_v08_6Mbps.mov' },
    { place: 'Liwa', time: 'day', file: 'comp_LW_L001_C006_t9_6M_tag0.mov' },
    { place: 'Dubai', time: 'night', file: 'comp_DB_D011_C010_v10_6Mbps.mov' },
    { place: 'Greenland', time: 'day', file: 'plate_G002_C002_BG_t9_6M_HB_tag0.mov' },
    { place: 'China', time: 'day', file: 'comp_C007_C011_08244D_001_v01_6M_HB_tag0.mov' },
    { place: 'Los Angeles', time: 'day', file: 'comp_LA_A006_C008_t9_6M_HB_tag0.mov' },
    { place: 'Dubai', time: 'day', file: 'comp_DB_D001_C001_v03_6Mbps.mov' },
    { place: 'Hong Kong', time: 'day', file: 'comp_HK_H004_C010_4k_v01_6Mbps.mov' },
    { place: 'Los Angeles', time: 'day', file: 'comp_LA_A008_C004_ALT_v33_6Mbps.mov' },
    { place: 'Dubai', time: 'day', file: 'comp_DB_D002_C003_t9_6M_HB_tag0.mov' },
    { place: 'China', time: 'day', file: 'comp_C007_C004_0824AJ_001_v01_6M_HB_tag0.mov' },
    { place: 'Dubai', time: 'day', file: 'comp_DB_D001_C005_t9_6M_HB_tag0.mov' },
    { place: 'Hong Kong', time: 'day', file: 'comp_HK_H004_C013_t9_6M_HB_tag0.mov' },
    { place: 'Dubai', time: 'day', file: 'comp_DB_D008_C010_v04_6Mbps.mov' },
    { place: 'Hawaii', time: 'day', file: 'b1-1.mov' },
    { place: 'London', time: 'night', file: 'b1-2.mov' },
    { place: 'New York City', time: 'day', file: 'b1-3.mov' },
    { place: 'San Francisco', time: 'night', file: 'b1-4.mov' },
    { place: 'China', time: 'day', file: 'b2-1.mov' },
    { place: 'Hawaii', time: 'day', file: 'b2-2.mov' },
    { place: 'New York City', time: 'night', file: 'b2-3.mov' },
    { place: 'San Francisco', time: 'night', file: 'b2-4.mov' },
    { place: 'London', time: 'night', file: 'b3-1.mov' },
    { place: 'New York City', time: 'day', file: 'b3-2.mov' },
    { place: 'San Francisco', time: 'day', file: 'b3-3.mov' },
    { place: 'Hawaii', time: 'day', file: 'b4-1.mov' },
    { place: 'New York City', time: 'night', file: 'b4-2.mov' },
    { place: 'San Francisco', time: 'day', file: 'b4-3.mov' },
    { place: 'China', time: 'day', file: 'b5-1.mov' },
    { place: 'London', time: 'day', file: 'b5-2.mov' },
    { place: 'San Francisco', time: 'night', file: 'b5-3.mov' },
    { place: 'China', time: 'day', file: 'b6-1.mov' },
    { place: 'Hawaii', time: 'night', file: 'b6-2.mov' },
    { place: 'London', time: 'day', file: 'b6-3.mov' },
    { place: 'San Francisco', time: 'night', file: 'b6-4.mov' },
    { place: 'Hawaii', time: 'day', file: 'b7-1.mov' },
    { place: 'New York City', time: 'day', file: 'b7-2.mov' },
    { place: 'San Francisco', time: 'night', file: 'b7-3.mov' },
    { place: 'San Francisco', time: 'night', file: 'b10-4.mov' },
    { place: 'San Francisco', time: 'day', file: 'b8-2.mov' },
    { place: 'San Francisco', time: 'day', file: 'b8-3.mov' },
    { place: 'Hawaii', time: 'day', file: 'b9-1.mov' },
    { place: 'London', time: 'night', file: 'b9-2.mov' },
    { place: 'San Francisco', time: 'day', file: 'b9-3.mov' },
    { place: 'Hawaii', time: 'day', file: 'b10-1.mov' },
    { place: 'New York City', time: 'night', file: 'b10-2.mov' },
    { place: 'San Francisco', time: 'day', file: 'b10-3.mov' },
    { place: 'Hawaii', time: 'night', file: 'b8-1.mov' }
  ];

  var list = FILES.map(function (item) {
    return { place: item.place, time: item.time, url: BASE + item.file };
  });

  /** Night videos from 7 p.m. to 6 a.m. */
  function isNight(hour) {
    return hour >= 19 || hour < 6;
  }

  /**
   * Picks a video that matches the time of day, avoiding the previous one when
   * possible. `random` returns 0..1 (Math.random on the TV, fixed in tests).
   */
  function pickAerial(items, hour, previousUrl, random) {
    if (!items || items.length === 0) {
      return null;
    }
    var wanted = isNight(hour) ? 'night' : 'day';
    var matching = items.filter(function (item) {
      return item.time === wanted;
    });
    var pool = matching.length > 0 ? matching : items;
    var fresh = pool.filter(function (item) {
      return item.url !== previousUrl;
    });
    var choices = fresh.length > 0 ? fresh : pool;
    var index = Math.min(Math.floor(random() * choices.length), choices.length - 1);
    return choices[index];
  }

  var api = { list: list, isNight: isNight, pickAerial: pickAerial };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.Launcher = root.Launcher || {};
    root.Launcher.aerials = api;
  }
})(typeof window !== 'undefined' ? window : this);
