import { algorithmParams } from './algorithm-params.js';

var gleech = (function(gleech) {
  'use strict';
  var imageData, originalImageData;
  /* Unified collection of all 68 glitch algorithms grouped by functional category */
  gleech.categories = {
    presets: ['theWorks', 'randomGlitch', 'glitch', 'preset1', 'preset2', 'preset3', 'preset4'],
    jpegCorrupt: ['jpegBlockRot', 'mosquitoRings', 'chromaBleed420', 'huffmanSlip', 'nyquistPoison', 'restartMarkerDrop', 'quantizeCrush', 'subsamplingShear', 'ghostBlocks'],
    digitalTV: ['tsPacketLoss', 'macroblockFreeze', 'digitalArtifacts'],
    analogCRT: ['DrumrollHorizontal', 'DrumrollVertical', 'DrumrollHorizontalWave', 'DrumrollVerticalWave', 'vcrTracking', 'verticalHold', 'antennaGhost', 'interlaceJitter'],
    dithering: ['ditherFloydSteinberg', 'ditherAtkinsons', 'ditherBayer', 'ditherBayer3', 'dither8Bit', 'ditherHalftone', 'ditherBitmask', 'ditherRandom', 'ditherRandom3'],
    pixelSorting: ['pixelFunk', 'superPixelFunk', 'sort', 'shortsort', 'shortdumbsort', 'slicesort', 'sortStripe', 'sortRows', 'randomSortRows', 'dumbSortRows', 'pixelSort'],
    geometry: ['slice', 'slice2', 'slice3', 'superSlice', 'superSlice2', 'scanlines', 'focusImage', 'fractal', 'fractal2', 'fractalGhosts', 'fractalGhosts2', 'fractalGhosts3', 'fractalGhosts4'],
    colorShifts: ['rgb_glitch', 'superShift', 'colorShift', 'colorShift2', 'redShift', 'greenShift', 'blueShift', 'invert']
  };

  gleech.all = [
    ...gleech.categories.presets,
    ...gleech.categories.jpegCorrupt,
    ...gleech.categories.digitalTV,
    ...gleech.categories.analogCRT,
    ...gleech.categories.dithering,
    ...gleech.categories.pixelSorting,
    ...gleech.categories.geometry,
    ...gleech.categories.colorShifts
  ];

  /* Structured parameter metadata and configurable controls for all 68 glitch commands */
  gleech.commands = algorithmParams;
  gleech.parameters = algorithmParams;

  gleech.init = function init(data) {
    if ( data.toString() !== "[object ImageData]" ) {
      throw new Error('Gleech expects ImageData');
    } else {
      gleech.imageData = data;
      gleech.originalImageData = data;
    }
    return this;
  };

  /***************************************************
   * Helper Functions
   ***************************************************/

  function adjustPixelError(data, i, error, multiplier) {
    data[i] = data[i] + multiplier * error[0];
    data[i + 1] = data[i + 1] + multiplier * error[1];
    data[i + 2] = data[i + 2] + multiplier * error[2];
  }

  /**
   * Helper to retrieve parameter options with sensible fallbacks:
   * 1. If options[key] is defined and not 'auto', parse and return it.
   * 2. Otherwise execute fallbackFn() (if provided) or return fallbackVal.
   */
  function getOpt(options, key, fallbackFn, fallbackVal) {
    if (options !== undefined && options !== null) {
      if (typeof options === 'object') {
        if (options[key] !== undefined && options[key] !== 'auto' && options[key] !== '') {
          var v = options[key];
          if (typeof fallbackVal === 'number' || (typeof fallbackFn === 'function' && typeof fallbackFn() === 'number')) {
            var num = Number(v);
            if (!isNaN(num)) return num;
          }
          if (typeof fallbackVal === 'boolean') {
            if (typeof v === 'boolean') return v;
            if (typeof v === 'string') return v === 'true' || v === '1';
          }
          return v;
        }
      } else if (typeof options === 'number' || typeof options === 'boolean' || typeof options === 'string') {
        if (options !== 'auto') {
          var asNum = Number(options);
          return !isNaN(asNum) ? asNum : options;
        }
      }
    }
    return typeof fallbackFn === 'function' ? fallbackFn() : fallbackVal;
  }

  // return random # < a
  function randFloor(a) {return Math.floor(Math.random() * a);}
  // return random # <= a
  function randRound(a) {return Math.round(Math.random() * a);}
  // return random # between A & B
  function randRange(a, b) {return Math.round(Math.random() * b) + a;}
  // relatively fair 50/50
  function coinToss() {return Math.random() > 0.5;}
  function randMinMax(min, max) {
    // generate min & max values by picking
    // one 'fairly', then picking another from the remainder
    var randA = Math.round(randRange(min, max));
    var randB = Math.round(randRange(randA, max));
    return [randA, randB];
  }
  function randMinMax2(min, max) {
    // generate min & max values by picking both fairly
    // then returning the lesser value before the greater.
    var randA = Math.round(randRange(min, max));
    var randB = Math.round(randRange(min, max));
    return randA < randB ? [randA, randB] : [randB, randA];
  }
  function randChoice(arr) {
    return arr[randFloor(arr.length)];
  }

  function randChance(percent) {
    // percent is a number 1-100
    return (Math.random() < (percent / 100));
  }

  function sum(o) {
    for (var s = 0, i = o.length; i; s += o[--i]) {}
    return s;
  }
  function leftSort(a, b) {return parseInt(a, 10) - parseInt(b, 10);}
  function rightSort(a, b) {return parseInt(b, 10) - parseInt(a, 10);}
  function blueSort(a, b) {
    var aa = a >> 24 & 0xFF,
      ar = a >> 16 & 0xFF,
      ag = a >> 8 & 0xFF,
      ab = a & 0xFF;
    var ba = b >> 24 & 0xFF,
      br = b >> 16 & 0xFF,
      bg = b >> 8 & 0xFF,
      bb = b & 0xFF;
    return aa - bb;
  }
  function redSort(a, b) {
    var aa = a >> 24 & 0xFF,
      ar = a >> 16 & 0xFF,
      ag = a >> 8 & 0xFF,
      ab = a & 0xFF;
    var ba = b >> 24 & 0xFF,
      br = b >> 16 & 0xFF,
      bg = b >> 8 & 0xFF,
      bb = b & 0xFF;
    return ar - br;
  }
  function greenSort(a, b) {
    var aa = a >> 24 & 0xFF,
      ar = a >> 16 & 0xFF,
      ag = a >> 8 & 0xFF,
      ab = a & 0xFF;
    var ba = b >> 24 & 0xFF,
      br = b >> 16 & 0xFF,
      bg = b >> 8 & 0xFF,
      bb = b & 0xFF;
    return ag - bg;
  }
  function avgSort(a, b) {
    var aa = a >> 24 & 0xFF,
      ar = a >> 16 & 0xFF,
      ag = a >> 8 & 0xFF,
      ab = a & 0xFF;
    var ba = b >> 24 & 0xFF,
      br = b >> 16 & 0xFF,
      bg = b >> 8 & 0xFF,
      bb = b & 0xFF;
    return ((aa + ar + ag + ab) / 4) - ((ba + br + bg + bb) / 4);
  }
  function randSort(a, b) {
    var sort = randChoice([coinToss, leftSort, rightSort, redSort, greenSort,
                          blueSort, avgSort]);
    return sort(a, b);
  }


  gleech.original = function original(imageData) {
    return imageData;
  };

  /***************************************************
   * Dithering
   ***************************************************/

  gleech.dither8Bit = function dither8Bit(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      size = Math.max(1, Math.round(getOpt(options, 'size', null, 4))),
      sum_r, sum_g, sum_b, avg_r, avg_g, avg_b;
    for (var y = 0; y < height; y += size) {
      for (var x = 0; x < width; x += size) {
        sum_r = 0;
        sum_g = 0;
        sum_b = 0;
        var s_y, s_x, i;
        for (s_y = 0; s_y < size; s_y++) {
          for (s_x = 0; s_x < size; s_x++) {
            i = 4 * (width * (y + s_y) + (x + s_x));
            sum_r += data[i];
            sum_g += data[i + 1];
            sum_b += data[i + 2];
          }
        }
        avg_r = (sum_r / (size * size)) > 127 ? 0xff : 0;
        avg_g = (sum_g / (size * size)) > 127 ? 0xff : 0;
        avg_b = (sum_b / (size * size)) > 127 ? 0xff : 0;
        for (s_y = 0; s_y < size; s_y++) {
          for (s_x = 0; s_x < size; s_x++) {
            i = 4 * (width * (y + s_y) + (x + s_x));
            data[i] = avg_r;
            data[i + 1] = avg_g;
            data[i + 2] = avg_b;
          }
        }
      }
    }
    return imageData;
  };

  gleech.ditherHalftone = function ditherHalftone(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      step = Math.max(2, Math.round(getOpt(options, 'size', null, 3)));
    for (var y = 0; y <= height - 2; y += 3) {
      for (var x = 0; x <= width - 2; x += 3) {
        var sum_r = 0, sum_g = 0, sum_b = 0;
        var indexed = [];
        var count = 0;
        for (var s_y = 0; s_y < 3; s_y++) {
          for (var s_x = 0; s_x < 3; s_x++) {
            var i = 4 * (width * (y + s_y) + (x + s_x));
            sum_r += data[i];
            sum_g += data[i + 1];
            sum_b += data[i + 2];
            data[i] = data[i + 1] = data[i + 2] = 0xff;
            indexed.push(i);
            count++;
          }
        }
        var avg_r = (sum_r / 9) > 127 ? 0xff : 0;
        var avg_g = (sum_g / 9) > 127 ? 0xff : 0;
        var avg_b = (sum_b / 9) > 127 ? 0xff : 0;
        var avg_lum = (avg_r + avg_g + avg_b) / 3;
        var scaled = Math.round((avg_lum * 9) / 255);
        if (scaled < 9) {
          data[indexed[4]] = avg_r;
          data[indexed[4] + 1] = avg_g;
          data[indexed[4] + 2] = avg_b;
        }
        if (scaled < 8) {
          data[indexed[5]] = avg_r;
          data[indexed[5] + 1] = avg_g;
          data[indexed[5] + 2] = avg_b;
        }
        if (scaled < 7) {
          data[indexed[1]] = avg_r;
          data[indexed[1] + 1] = avg_g;
          data[indexed[1] + 2] = avg_b;
        }
        if (scaled < 6) {
          data[indexed[6]] = avg_r;
          data[indexed[6] + 1] = avg_g;
          data[indexed[6] + 2] = avg_b;
        }
        if (scaled < 5) {
          data[indexed[3]] = avg_r;
          data[indexed[3] + 1] = avg_g;
          data[indexed[3] + 2] = avg_b;
        }
        if (scaled < 4) {
          data[indexed[8]] = avg_r;
          data[indexed[8] + 1] = avg_g;
          data[indexed[8] + 2] = avg_b;
        }
        if (scaled < 3) {
          data[indexed[2]] = avg_r;
          data[indexed[2] + 1] = avg_g;
          data[indexed[2] + 2] = avg_b;
        }
        if (scaled < 2) {
          data[indexed[0]] = avg_r;
          data[indexed[0] + 1] = avg_g;
          data[indexed[0] + 2] = avg_b;
        }
        if (scaled < 1) {
          data[indexed[7]] = avg_r;
          data[indexed[7] + 1] = avg_g;
          data[indexed[7] + 2] = avg_b;
        }
      }
    }
    return imageData;
  };

  gleech.ditherAtkinsons = function ditherAtkinsons(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      threshold = getOpt(options, 'threshold', null, 128);
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var i = 4 * (y * width + x);
        var old_r = data[i];
        var old_g = data[i + 1];
        var old_b = data[i + 2];
        var new_r = (old_r > threshold) ? 0xff : 0;
        var new_g = (old_g > threshold) ? 0xff : 0;
        var new_b = (old_b > threshold) ? 0xff : 0;
        data[i] = new_r;
        data[i + 1] = new_g;
        data[i + 2] = new_b;
        var err_r = old_r - new_r;
        var err_g = old_g - new_g;
        var err_b = old_b - new_b;
        // Redistribute the pixel's error like this:
        //       *  1/8 1/8
        //  1/8 1/8 1/8
        //      1/8
        // The ones to the right...
        var adj_i = 0;
        if (x < width - 1) {
          adj_i = i + 4;
          adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
          // The pixel that's down and to the right
          if (y < height - 1) {
            adj_i = adj_i + (width * 4) + 4;
            adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
          }
          // The pixel two over
          if (x < width - 2) {
            adj_i = i + 8;
            adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
          }
        }
        if (y < height - 1) {
          // The one right below
          adj_i = i + (width * 4);
          adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
          if (x > 0) {
            // The one to the left
            adj_i = adj_i - 4;
            adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
          }
          if (y < height - 2) {
            // The one two down
            adj_i = i + (2 * width * 4);
            adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
          }
        }
      }
    }
    return imageData;
  };

  gleech.ditherFloydSteinberg = function ditherFloydSteinberg(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      threshold = getOpt(options, 'threshold', null, 128);
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var i = 4 * (y * width + x);
        var old_r = data[i];
        var old_g = data[i + 1];
        var old_b = data[i + 2];
        var new_r = (old_r > threshold) ? 0xff : 0;
        var new_g = (old_g > threshold) ? 0xff : 0;
        var new_b = (old_b > threshold) ? 0xff : 0;
        data[i] = new_r;
        data[i + 1] = new_g;
        data[i + 2] = new_b;
        var err_r = old_r - new_r;
        var err_g = old_g - new_g;
        var err_b = old_b - new_b;
        // Redistribute the pixel's error like this:
        //   * 7
        // 3 5 1
        // The ones to the right...
        var right_i = 0, down_i = 0, left_i = 0, next_right_i = 0;
        if (x < width - 1) {
          right_i = i + 4;
          adjustPixelError(data, right_i, [err_r, err_g, err_b], 7 / 16);
          // The pixel that's down and to the right
          if (y < height - 1) {
            next_right_i = right_i + (width * 4);
            adjustPixelError(data, next_right_i, [err_r, err_g, err_b],
                             1 / 16);
          }
        }
        if (y < height - 1) {
          // The one right below
          down_i = i + (width * 4);
          adjustPixelError(data, down_i, [err_r, err_g, err_b], 5 / 16);
          if (x > 0) {
            // The one down and to the left...
            left_i = down_i - 4;
            adjustPixelError(data, left_i, [err_r, err_g, err_b], 3 /
                             16);
          }
        }
      }
    }
    return imageData;
  };

  gleech.ditherBayer = function ditherBayer(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
    threshold_maps = [
      [
        [3, 7, 4],
        [6, 1, 9],
        [2, 8, 5]
      ],
      [
        [1, 9, 3, 11],
        [13, 5, 15, 7],
        [4, 12, 2, 10],
        [16, 8, 14, 6]
      ],
      [
        [1, 49, 13, 61, 4, 52, 16, 64],
        [33, 17, 45, 29, 36, 20, 48, 32],
        [9, 57, 5, 53, 12, 60, 8, 56],
        [41, 25, 37, 21, 44, 28, 40, 24],
        [3, 51, 15, 63, 2, 50, 14, 62],
        [35, 19, 47, 31, 34, 18, 46, 30],
        [11, 59, 7, 55, 10, 58, 6, 54],
        [43, 27, 39, 23, 42, 26, 38, 22]
      ]
    ],
    mapIdx = getOpt(options, 'mapIndex', function() { return randFloor(threshold_maps.length); }),
    threshold_map = threshold_maps[Math.abs(mapIdx) % threshold_maps.length],
      size = threshold_map.length;
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var i = 4 * (y * width + x);
        var gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
        var scaled = (gray * 17) / 255;
        var val = scaled < threshold_map[x % size][y % size] ? 0 : 0xff;
        data[i] = data[i + 1] = data[i + 2] = val;
      }
    }
    return imageData;
  };

  gleech.ditherBayer3 = function ditherBayer3(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
    threshold_maps = [
      [
        [3, 7, 4],
        [6, 1, 9],
        [2, 8, 5]
      ],
      [
        [1, 9, 3, 11],
        [13, 5, 15, 7],
        [4, 12, 2, 10],
        [16, 8, 14, 6]
      ],
      [
        [1, 49, 13, 61, 4, 52, 16, 64],
        [33, 17, 45, 29, 36, 20, 48, 32],
        [9, 57, 5, 53, 12, 60, 8, 56],
        [41, 25, 37, 21, 44, 28, 40, 24],
        [3, 51, 15, 63, 2, 50, 14, 62],
        [35, 19, 47, 31, 34, 18, 46, 30],
        [11, 59, 7, 55, 10, 58, 6, 54],
        [43, 27, 39, 23, 42, 26, 38, 22]
      ]
    ],
    mapIdx = getOpt(options, 'mapIndex', function() { return randFloor(threshold_maps.length); }),
    threshold_map = threshold_maps[Math.abs(mapIdx) % threshold_maps.length],
      size = threshold_map.length;
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var i = 4 * (y * width + x);
        /* apply the tranformation to each color */
        data[i] = ((data[i] * 17) / 255) < threshold_map[x % size][y %
          size] ? 0 : 0xff;
          data[i + 1] = ((data[i + 1] * 17) / 255) < threshold_map[x %
            size][y % size] ? 0 : 0xff;
            data[i + 2] = ((data[i + 2] * 17) / 255) < threshold_map[x %
              size][y % size] ? 0 : 0xff;
      }
    }
    return imageData;
  };

  gleech.ditherRandom = function ditherRandom(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      userThresh = getOpt(options, 'threshold', null, null);
    for (var i = 0, val, scaled, size = width * height * 4; i < size; i += 4) {
      scaled = ((data[i] + data[i + 1] + data[i + 2]) / 3) % 255;
      val = scaled < (userThresh !== null && userThresh !== undefined ? userThresh : randRound(128)) ? 0 : 0xff;
      data[i] = data[i + 1] = data[i + 2] = val;
    }
    return imageData;
  };

  gleech.ditherRandom3 = function ditherRandom3(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      userThresh = getOpt(options, 'threshold', null, null);
    for (var i = 0, size = width * height * 4; i < size; i += 4) {
      var t = userThresh !== null && userThresh !== undefined ? userThresh : randRound(128);
      data[i] = data[i] < t ? 0 : 0xff;
      data[i + 1] = data[i + 1] < t ? 0 : 0xff;
      data[i + 2] = data[i + 2] < t ? 0 : 0xff;
    }
    return imageData;
  };

  gleech.ditherBitmask = function ditherBitmask(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      M = Math.round(getOpt(options, 'mask', function() { return randRange(1, 125); }));
    // 0xc0; 2 bits
    // 0xe0  3 bits
    // 0xf0  4 bits
    for (var i = 0, size = width * height * 4; i < size; i += 4) {
      // data[i] |= M;
      // data[i + 1] |= M;
      // data[i + 2] |= M;
      data[i] |= M;
      data[i + 1] |= M;
      data[i + 2] |= M;
    }
    return imageData;
  };


  /***************************************************
   * Glitch
   ***************************************************/
  gleech.colorShift = function colorShift(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      mode = getOpt(options, 'mode', null, 'random'),
      dir = mode === 'forward' ? true : (mode === 'reverse' ? false : coinToss());
    for (var i = 0, size = width * height * 4; i < size; i += 4) {
      var r = data[i],
        g = data[i + 1],
        b = data[i + 2];
      data[i] = dir ? g : b;
      data[i + 1] = dir ? b : r;
      data[i + 2] = dir ? r : g;
    }
    return imageData;
  };
  gleech.colorShift2 = function colorShift2(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = new Uint32Array(imageData.data.buffer),
      mode = getOpt(options, 'mode', null, 'random'),
      dir = mode === 'forward' ? true : (mode === 'reverse' ? false : coinToss());
    for (var i = 0, size = data.length; i < size; i++) {
      var a = data[i] >> 24 & 0xFF,
        r = data[i] >> 16 & 0xFF,
        g = data[i] >> 8 & 0xFF,
        b = data[i] & 0xFF;
      r = (dir ? g : b) & 0xFF;
      g = (dir ? b : r) & 0xFF;
      b = (dir ? r : g) & 0xFF;
      data[i] = (a << 24) + (r << 16) + (g << 8) + (b);
    }
    return imageData;
  };

  gleech.greenShift = function greenShift(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      factor = Math.round(getOpt(options, 'amount', function() { return randFloor(64); }));
    for (var i = 0, size = width * height * 4; i < size; i += 4) {
      var shift = data[i + 1] + factor;
      data[i] -= factor;
      data[i + 1] = (shift) > 255 ? 255 : shift;
      data[i + 2] -= factor;
    }
    return imageData;
  };

  gleech.redShift = function redShift(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      factor = Math.round(getOpt(options, 'amount', function() { return randFloor(64); }));
    for (var i = 0, size = width * height * 4; i < size; i += 4) {
      var shift = data[i] + factor;
      data[i] = (shift) > 255 ? 255 : shift;
      data[i + 1] -= factor;
      data[i + 2] -= factor;
    }
    return imageData;
  };

  gleech.blueShift = function blueShift(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      factor = Math.round(getOpt(options, 'amount', function() { return randFloor(64); }));
    for (var i = 0, size = width * height * 4; i < size; i += 4) {
      var shift = data[i + 2] + factor;
      data[i] -= factor;
      data[i + 1] -= factor;
      data[i + 2] = (shift) > 255 ? 255 : shift;
    }
    return imageData;
  };

  gleech.superShift = function superShift(imageData, options) {
    var l = Math.max(1, Math.round(getOpt(options, 'shift', function() { return randRange(1, 10); })));
    for (var i = 0; i < l; i++) {
      imageData = gleech.colorShift(imageData, options);
    }
    return imageData;
  };

  // TODO: delete this function
  gleech.getColors = function getColors(imageData) {
    var data = new Uint32Array(imageData.data.buffer),
      height = imageData.height,
      width = imageData.width;
    console.log(data[0].toString(16));
    console.log((~ data[0] | 0xFF000000).toString(16));
    for (var i = 8; i--;) {
      console.log(randChoice(data).toString(16));
    }
    return imageData;
  };

  gleech.superPixelFunk = function superPixelFunk(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      height = imageData.height,
      width = imageData.width,
      pixelation = Math.max(1, Math.round(getOpt(options, 'pixelation', function() { return randRange(2, 15); }))),
      chance = getOpt(options, 'chance', null, 50),
      colorOpt = getOpt(options, 'color', null, 'random');
    for (var y = 0; y < height; y += pixelation) {
      for (var x = 0; x < width; x += pixelation) {
        if (randChance(chance)) {
          var locale = coinToss();
          var mask = colorOpt === 'red' ? 0x00FF0000 : (colorOpt === 'green' ? 0x0000FF00 : (colorOpt === 'blue' ? 0x000000FF : randChoice([0x00FF0000, 0x0000FF00, 0x000000FF])));
          var i = coinToss() ? (y * width + x) :
            (y * width + (x - (pixelation * 2)));
          for (var n = 0; n < pixelation; n++) {
            for (var m = 0; m < pixelation; m++) {
              if (x + m < width) {
                var j = ((width * (y + n)) + (x + m));
                data[j] = locale ? data[i] : data[j] | mask;
              }
            }
          }
        }
      }
    }
    return imageData;
  };

  gleech.pixelFunk = function pixelFunk(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      height = imageData.height,
      width = imageData.width,
      pixelation = Math.max(1, Math.round(getOpt(options, 'pixelation', function() { return randRange(2, 10); }))),
      chance = getOpt(options, 'chance', null, 50);
    for (var y = 0; y < height; y += pixelation) {
      for (var x = 0; x < width; x += pixelation) {
        if (randChance(chance)) {
          var i = (y * width + x);
          for (var n = 0; n < pixelation; n++) {
            for (var m = 0; m < pixelation; m++) {
              if (x + m < width) {
                var j = ((width * (y + n)) + (x + m));
                data[j] = data[i];
              }
            }
          }
        }
      }
    }
    return imageData;
  };
  gleech.focusImage = function focusImage(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      height = imageData.height,
      width = imageData.width,
      pixelation = Math.max(1, Math.round(getOpt(options, 'radius', function() { return randRange(2, 10); })));
    for (var y = 0; y < height; y += pixelation) {
      for (var x = 0; x < width; x += pixelation) {
        var i = (y * width + x);
        for (var n = 0; n < pixelation; n++) {
          for (var m = 0; m < pixelation; m++) {
            if (x + m < width) {
              var j = ((width * (y + n)) + (x + m));
              data[j] = data[i];
            }
          }
        }
      }
    }
    return imageData;
  };

  gleech.slice = function slice(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      slices = Math.max(1, Math.round(getOpt(options, 'slices', null, 1)));
    for (var s = 0; s < slices; s++) {
      var cutend = randFloor(width * height * 4),
        cutstart = Math.floor(cutend / 1.7),
        cut = data.subarray(cutstart, cutend);
      data.set(cut, randFloor((width * height * 4) - cut.length));
    }
    imageData.data.set(data);
    return imageData;
  };

  gleech.slice2 = function slice2(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      l = Math.max(1, Math.round(getOpt(options, 'slices', function() { return randRound(11); })));
    for (var i = 0; i < l; i++) {
      var cutend = Math.random() < 0.75 ? randFloor(width * height * 4) :
        (width * height * 4),
      cutstart = Math.floor(cutend / 1.7),
        cut = data.subarray(cutstart, cutend);
      //data.set(cut, randFloor(width * height * 2));
      data.set(cut, randFloor((width * height * 4) - cut.length));
    }
    imageData.data.set(data);
    return imageData;
  };

  gleech.slice3 = function slice3(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      l = Math.max(1, Math.round(getOpt(options, 'slices', function() { return randRound(20); })));
    for (var i = 0; i < l; i++) {
      var cutend = randFloor(width * height * 4),
        cutstart = cutend - randRange(1000, 5100),
        cut = data.subarray(cutstart, cutend);
      data.set(cut, randFloor((width * height * 4) - cut.length));
      //data.set(cut, randFloor(width * height * 2));
    }
    imageData.data.set(data);
    return imageData;
  };


  gleech.superSlice2 = function superSlice2(imageData, options) {
    var functs = ['slice', 'slice2', 'slice3'],
      l = Math.max(1, Math.round(getOpt(options, 'iterations', function() { return randRound(functs.length); })));
    for (var i = 0; i < l; i++) {
      var fun = randFloor(functs.length);
      imageData = gleech[functs[fun]](imageData);
    }
    return imageData;
  };

  gleech.superSlice = function superSlice(imageData, options) {
    var l = Math.max(1, Math.round(getOpt(options, 'iterations', function() { return randRange(1, 10); })));
    for (var i = 0; i < l; i++) {
      imageData = gleech.slice(gleech.slice2(gleech.slice3(imageData)));
    }
    return imageData;
  };

  gleech.fractalGhosts = function fractalGhosts(imageData, options) {
    var data = imageData.data,
      ghosts = Math.max(1, Math.round(getOpt(options, 'ghosts', null, 1)));
    for (var g = 0; g < ghosts; g++) {
      for (var i = 0; i < data.length; i++) {
        if (parseInt(data[i * 2 % data.length], 10) < parseInt(data[i], 10)) {
          data[i] = data[i * 2 % data.length];
        }
      }
    }
    imageData.data.set(data);
    return imageData;
  };

  gleech.fractalGhosts2 = function fractalGhosts2(imageData, options) {
    var data = imageData.data,
      rand = Math.max(1, Math.round(getOpt(options, 'ghosts', function() { return randRange(1, 10); })));
    for (var i = 0; i < data.length; i++) {
      var tmp = (i * rand) % data.length;
      if (parseInt(data[tmp], 10) < parseInt(data[i], 10)) {
        data[i] = data[tmp];
      }
    }
    imageData.data.set(data);
    return imageData;
  };

  gleech.fractalGhosts3 = function fractalGhosts3(imageData, options) {
    var data = imageData.data,
      rand = Math.max(1, Math.round(getOpt(options, 'ghosts', function() { return randRange(1, 10); }))),
      color = Math.round(getOpt(options, 'channel', function() { return randRange(0, 4); }));
    for (var i = 0; i < data.length; i++) {
      if ((i % 4) === color) {
        data[i] = 0xFF;
        continue;
      }
      var tmp = (i * rand) % data.length;
      if (parseInt(data[tmp], 10) < parseInt(data[i], 10)) {
        data[i] = data[tmp];
      }
    }
    imageData.data.set(data);
    return imageData;
  };

  gleech.fractalGhosts4 = function fractalGhosts4(imageData, options) {
    var data = imageData.data,
      color = Math.round(getOpt(options, 'channel', function() { return randRange(0, 4); }));
    for (var i = 0; i < data.length; i++) {
      if ((i % 4) === color) {
        data[i] = 0xFF;
        continue;
      }
      if (parseInt(data[i * 2 % data.length], 10) < parseInt(data[i], 10)) {
        data[i] = data[i * 2 % data.length];
      }
    }
    imageData.data.set(data);
    return imageData;
  };
  gleech.fractal = function fractal(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      passes = Math.max(1, Math.round(getOpt(options, 'passes', null, 1)));
    for (var p = 0; p < passes; p++) {
      for (var i = data.length; i; i--) {
        if (parseInt(data[(i * 2) % data.length], 10) < parseInt(data[i], 10)) {
          data[i] = data[(i * 2) % data.length];
        }
      }
    }
    return imageData;
  };
  gleech.fractal2 = function fractal2(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer);
    var m = Math.max(2, Math.round(getOpt(options, 'passes', function() { return randRange(2, 8); })));
    for (var i = 0; i < data.length; i++) {
      if (parseInt(data[(i * m) % data.length], 10) < parseInt(data[i], 10)) {
        data[i] = data[(i * m) % data.length];
      }
    }
    return imageData;
  };
  gleech.shortsort = function shortsort(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      segments = Math.max(1, Math.round(getOpt(options, 'segments', null, 1)));
    for (var s = 0; s < segments; s++) {
      var mm = randMinMax(0, imageData.height * imageData.width);
      mm = randMinMax2(mm[0], mm[1]);
      var cut = data.subarray(mm[0], mm[1]);
      if (coinToss()) {
        Array.prototype.sort.call(cut, leftSort);
      } else {
        Array.prototype.sort.call(cut, rightSort);
      }
    }
    imageData.data.set(data.buffer);
    return imageData;
  };
  gleech.shortdumbsort = function shortdumbsort(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      segments = Math.max(1, Math.round(getOpt(options, 'segments', null, 1)));
    for (var s = 0; s < segments; s++) {
      var mm = randMinMax(0, imageData.width * imageData.height);
      mm = randMinMax2(mm[0], mm[1]);
      var da = data.subarray(mm[0], mm[1]);
      Array.prototype.sort.call(da);
      imageData.data.set(da, mm[0]);
    }
    return imageData;
  };

  gleech.sort = function sort(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      dir = getOpt(options, 'direction', null, 'auto');
    if (dir === 'left') {
      Array.prototype.sort.call(data, leftSort);
    } else if (dir === 'right') {
      Array.prototype.sort.call(data, rightSort);
    } else {
      Array.prototype.sort.call(data, coinToss() ? leftSort : rightSort);
    }
    imageData.data.set(data, 0);
    return imageData;
  };
  gleech.slicesort = function slicesort(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      iterations = Math.max(1, Math.round(getOpt(options, 'iterations', null, 1)));
    for (var it = 0; it < iterations; it++) {
      var mm = randMinMax(0, data.length);
      mm = randMinMax(mm[0], mm[1]);
      mm = randMinMax(mm[0], mm[1]);
      var cut = data.subarray(mm[0], mm[1]),
        offset = Math.abs(randRound(data.length) - cut.length) % data.length;
      Array.prototype.sort.call(cut, leftSort);
      imageData.data.set(data.buffer, coinToss() ? offset : mm[0]);
    }
    return imageData;
  };

  gleech.sortRows = function sortRows(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      width = imageData.width, height = imageData.height,
      step = Math.max(1, Math.round(getOpt(options, 'step', null, 1)));
    for (var i = 0, size = data.length + 1; i < size; i += (width * step)) {
      var da = data.subarray(i, i + width);
      Array.prototype.sort.call(da, leftSort);
      da.copyWithin(data, i);
    }
    imageData.data.set(data.buffer);
    return imageData;
  };

  gleech.sortStripe = function sortStripe(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      width = imageData.width,
      stripes = Math.max(1, Math.round(getOpt(options, 'stripes', null, 1)));
    for (var s = 0; s < stripes; s++) {
      var mm = randMinMax(0, width);
      mm = randMinMax2(mm[0], mm[1]);
      for (var i = 0, size = data.length + 1; i < size; i += width) {
        var da = data.subarray(i + mm[0], i + mm[1]);
        Array.prototype.sort.call(da, leftSort);
        da.copyWithin(data, i + mm[0]);
      }
    }
    imageData.data.set(data.buffer);
    return imageData;
  };

  gleech.dumbSortRows = function dumbSortRows(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      width = imageData.width, height = imageData.height,
      chance = getOpt(options, 'chance', null, 100);
    for (var i = 0, size = data.length; i < size; i += width) {
      if (!randChance(chance)) continue;
      // var mm = randMinMax(i, i + width);
      // var da = data.subarray(mm[0], mm[1]);
      var da = data.subarray(i, i + width);
      Array.prototype.sort.call(da);
      data.set(da, i);
      /*
         for (var i = 0, size = data.length; i < size; i += width) {
         var da = Array.apply([], data.subarray(i, i + width));
         da.sort(coinToss);
         data.set(da, i);
         */
    }
    imageData.data.set(data.buffer);
    return imageData;
  };
  gleech.randomSortRows = function randomSortRows(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      width = imageData.width, height = imageData.height,
      chance = getOpt(options, 'chance', null, 100);
    for (var i = 0, size = data.length; i < size; i += width) {
      if (!randChance(chance)) continue;
      // var mm = randMinMax(i, i + width);
      // var da = data.subarray(mm[0], mm[1]);
      var da = data.subarray(i, i + width);
      Array.prototype.sort.call(da, coinToss);
      data.set(da, i);
      /*
         for (var i = 0, size = data.length; i < size; i += width) {
         var da = Array.apply([], data.subarray(i, i + width));
         da.sort(coinToss);
         data.set(da, i);
         */
    }
    imageData.data.set(data.buffer);
    return imageData;
  };

  gleech.invert = function invert(imageData, options) {
    var channel = getOpt(options, 'channel', null, 'all');
    if (channel === 'all') {
      var data = new Uint32Array(imageData.data.buffer);
      for (var i = 0; i < data.length; i++) {
        data[i] = ~ data[i] | 0xFF000000;
      }
      imageData.data.set(data.buffer);
    } else {
      var d = imageData.data;
      var chIdx = channel === 'red' ? 0 : (channel === 'green' ? 1 : 2);
      for (var j = 0; j < d.length; j += 4) {
        d[j + chIdx] = 255 - d[j + chIdx];
      }
    }
    return imageData;
  };
  gleech.rgb_glitch = function rgb_glitch(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height,
      shiftVal = getOpt(options, 'shift', function() { return randRange(10, Math.max(11, width - 10)); }),
      mm = [shiftVal, shiftVal],
      opt = mm[1] % 3,
      dir = coinToss();
    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var index = ((width * y) + x) * 4,
          red = data[index],
          green = data[index + 1],
          blue = data[index + 2];
        if (dir) {
          if (opt === 0) {
            data[index + mm[0]] = red;
            data[index + mm[0] + 1] = green;
            data[index] = blue;
          }else if (opt === 1) {
            data[index] = red;
            data[index + mm[0] + 1] = green;
            data[index + mm[0]] = blue;
          } else {
            data[index + mm[0]] = red;
            data[index + 1] = green;
            data[index + mm[0]] = blue;
          }
        } else {
          if (opt === 0) {
            data[index - mm[0] + 1] = red;
            data[index - mm[0]] = green;
            data[index] = blue;
          }else if (opt === 1) {
            data[index + 1] = red;
            data[index - mm[0]] = green;
            data[index - mm[0]] = blue;
          } else {
            data[index - mm[0] + 1] = red;
            data[index] = green;
            data[index - mm[0]] = blue;
          }
        }
      }
    }
    imageData.data.set(data);
    return imageData;
  };
  gleech.DrumrollVerticalWave = function DrumrollVerticalWave(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height,
      freq = getOpt(options, 'frequency', function() { return 1; }),
      roll = 0;
    for (var x = 0; x < width; x++) {
      if (Math.random() > 0.95) roll = Math.floor(Math.cos(x * freq) * (height * 2));
      if (Math.random() > 0.98) roll = 0;

      for (var y = 0; y < height; y++) {
        var idx = (x + y * width) * 4;

        var y2 = y + roll;
        if (y2 > height - 1) y2 -= height;
        var idx2 = (x + y2 * width) * 4;

        for (var c = 0; c < 4; c++) {
          data[idx2 + c] = data[idx + c];
        }
      }
    }

    imageData.data.set(data);
    return imageData;
  };
  gleech.DrumrollHorizontalWave = function DrumrollHorizontalWave(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height,
      freq = getOpt(options, 'frequency', function() { return 1; }),
      roll = 0;
    for (var x = 0; x < width; x++) {
      if (Math.random() > 0.95) roll = Math.floor(Math.cos(x * freq) * (height * 2));
      if (Math.random() > 0.98) roll = 0;

      for (var y = 0; y < height; y++) {
        var idx = (x + y * width) * 4;

        var x2 = x + roll;
        if (x2 > width - 1) x2 -= width;
        var idx2 = (x2 + y * width) * 4;

        for (var c = 0; c < 4; c++) {
          data[idx2 + c] = data[idx + c];
        }
      }
    }

    imageData.data.set(data);
    return imageData;
  };
  gleech.DrumrollVertical = function DrumrollVertical(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height,
      rolls = Math.max(1, Math.round(getOpt(options, 'rolls', null, 1))),
      roll = 0;
    for (var x = 0; x < width; x++) {
      if (Math.random() > 0.95) roll = randFloor(height);
      if (Math.random() > 0.95) roll = 0;

      for (var y = 0; y < height; y++) {
        var idx = (x + y * width) * 4;

        var y2 = y + roll;
        if (y2 > height - 1) y2 -= height;
        var idx2 = (x + y2 * width) * 4;

        for (var c = 0; c < 4; c++) {
          data[idx2 + c] = data[idx + c];
        }
      }
    }

    imageData.data.set(data);
    return imageData;
  };
  gleech.DrumrollHorizontal = function DrumrollHorizontal(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height,
      rolls = Math.max(1, Math.round(getOpt(options, 'rolls', null, 1))),
      roll = 0;
    for (var x = 0; x < width; x++) {
      if (Math.random() < 0.05) roll = randFloor(height);
      if (Math.random() < 0.05) roll = 0;

      for (var y = 0; y < height; y++) {
        var idx = (x + y * width) * 4;

        var x2 = x + roll;
        if (x2 > width - 1) x2 -= width;
        var idx2 = (x2 + y * width) * 4;

        for (var c = 0; c < 4; c++) {
          data[idx2 + c] = data[idx + c];
        }
      }
    }

    imageData.data.set(data);
    return imageData;
  };

  gleech.scanlines = function scanlines(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      width = imageData.width, height = imageData.height,
      type = randRange(0, 3),
      size = Math.max(1, Math.round(getOpt(options, 'density', function() { return randRange(3, 15); }))),
      xorNum = randChoice([0x00555555, 0x00FF00FF00, 0x00F0F0F0, 0x00333333]),
      orNum = randChoice([0xFF555555, 0xFFFF00FF00, 0xFFF0F0F0, 0xFF333333]);
    for (var i = 0, l = data.length; i < l; i += (width * size)) {
      var row = Array.apply([], data.subarray(i, i + width));
      for (var p in row) {
        if (type === 0) {
          row[p] = row[p] ^ xorNum;
        } else if (type === 1) {
          row[p] = row[p] | orNum;
        } else {
          // invert
          row[p] = ~ row[p] | 0xFF000000;
        }
      }
      data.set(row, i);
    }
    imageData.data.set(data.buffer);
    return imageData;
  };

  gleech.pixelSort = function pixelSort(imageData, options) {
    var data = new Uint32Array(imageData.data.buffer),
      width = imageData.width, height = imageData.height,
      thresh = getOpt(options, 'threshold', null, 128);
    var hexVal = Math.min(255, Math.max(0, thresh)).toString(16).padStart(2, '0');
    var upper = parseInt('FF' + hexVal + hexVal + hexVal, 16);
    var lower = 0xFF222222;
    for (var i = 0, size = data.length; i < size; i += width) {
      var row = Array.apply([], data.subarray(i, i + width));
      var low = 0, high = 0;
      for (var j in row) {
        if (!high && !low && row[j] >= low) {
          low = j;
        }
        if (low && !high && row[j] >= high) {
          high = j;
        }
      }
      if (low) {
        var da = row.slice(low, high);
        Array.prototype.sort.call(da, leftSort);
        data.set(da, (i + low) % (height * width));
      }
    }
    imageData.data.set(data.buffer);
    return imageData;
  };



  // templates for making new glitches
  gleech.XYtemplate = function XYtemplate(imageData) {
    var data = new Uint32Array(imageData.data.buffer),
      width = imageData.width, height = imageData.height;
    for (var y = 0; y < height; ++y) {
      for (var x = 0; x < width; ++x) {
        // do stuff to a 32bit pixel
        // ex: invert pixel colors
        // data[y * width + x] = ~ data[y * width + x] | 0xFF000000;
      }
    }
    imageData.data.set(data.buffer);
    return imageData;
  };
  gleech.RowTemplate = function RowTemplate(imageData) {
    var data = new Uint32Array(imageData.data.buffer),
      width = imageData.width, height = imageData.height;
    for (var i = 0, size = data.length; i < size; i += width) {
      var row = Array.apply([], data.subarray(i, i + width));
      // transform `row`, which contains a row of 32bit pixels
      // ex: make a black stripe 5px apart
      // if (i % 5 == 0) {
      //   for (var p in row) {
      //     row[p] = 0xFF000000;
      //   }
      // }
      data.set(row, i);
    }
    imageData.data.set(data.buffer);
    return imageData;
  };


  gleech.preset1 = function preset1(imageData) {
    var ops = ['ditherRandom3', 'shortdumbsort', 'slice', 'invert', 'shortsort', 'shortsort', 'ditherRandom3', 'DrumrollVerticalWave', 'ditherBayer3', 'dumbSortRows', 'slicesort', 'DrumrollVertical'];
    for (var i in ops) {
      gleech[ops[i]](imageData);
    }
    return imageData;
  };
  gleech.preset2 = function preset2(imageData) {
    var ops = ['shortsort', 'slice2', 'fractalGhosts4', 'sort', 'fractalGhosts2', 'colorShift'];
    for (var i in ops) {
      gleech[ops[i]](imageData);
    }
    return imageData;
  };
  gleech.preset3 = function preset3(imageData) {
    var ops = ['ditherRandom3', 'focusImage', 'scanlines'];
    for (var i in ops) {
      gleech[ops[i]](imageData);
    }
    return imageData;
  };
  gleech.preset4 = function preset4(imageData) {
    var ops = ['ditherAtkinsons', 'focusImage', 'ditherRandom3', 'focusImage'];
    for (var i in ops) {
      gleech[ops[i]](imageData);
    }
    return imageData;
  };


  /* these run random set of functions */

  gleech.theWorks = function theWorks(imageData, options) {
    var functions = gleech.all.slice(0);
    functions.sort(coinToss);
    // filter out meta presets and stacked sorts, because stacked sorts are boring
    functions = functions.filter(function(item) {
      return item !== 'theWorks' && item !== 'randomGlitch' && item !== 'glitch' && item.indexOf('preset') === -1 && item.indexOf('sort') === -1;
    });
    for (var i = 0, l = functions.length; i < l; i++) {
      if (typeof gleech[functions[i]] === 'function') {
        gleech[functions[i]](imageData);
      }
    }
    return imageData;
  };

  gleech.randomGlitch = function randomGlitch(imageData, options) {
    var functions = gleech.all.filter(function(item) {
      return item !== 'randomGlitch';
    });
    var history = [];
    for (var i = 0, l = randRange(3, 6); i < l; i++) {
      var fun = randFloor(functions.length);
      if (typeof gleech[functions[fun]] === 'function') {
        gleech[functions[fun]](imageData);
        history.push(functions[fun]);
      }
    }
    if (history.length === 0) {
      return gleech.randomGlitch(imageData, options);
    }
    console.log('randomGlitch history:', history);
    return imageData;
  };

  /***************************************************
   * JPEG & Anti-JPEG Corruption Algorithms
   ***************************************************/

  // 1. jpegBlockRot: 8x8 MCU phase desync & DC drift
  gleech.jpegBlockRot = function jpegBlockRot(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      blockSize = Math.max(4, Math.round(getOpt(options, 'blockSize', null, 8))),
      chromaShift = getOpt(options, 'chromaShift', null, true);
    for (var by = 0; by < height; by += blockSize) {
      for (var bx = 0; bx < width; bx += blockSize) {
        if (Math.random() < 0.65) {
          var sumR = 0, sumG = 0, sumB = 0, count = 0;
          for (var py = 0; py < blockSize && by + py < height; py++) {
            for (var px = 0; px < blockSize && bx + px < width; px++) {
              var idx = ((by + py) * width + (bx + px)) * 4;
              sumR += data[idx];
              sumG += data[idx + 1];
              sumB += data[idx + 2];
              count++;
            }
          }
          if (count === 0) continue;
          var dcR = sumR / count,
            dcG = sumG / count,
            dcB = sumB / count;

          var rotDrift = Math.random() < 0.4 ? (randFloor(90) - 45) : 0;
          var qStep = Math.random() < 0.5 ? 48 : 32;

          for (var py = 0; py < blockSize && by + py < height; py++) {
            for (var px = 0; px < blockSize && bx + px < width; px++) {
              var idx = ((by + py) * width + (bx + px)) * 4;
              var isBorder = (px === blockSize - 1 || py === blockSize - 1);
              if (isBorder && Math.random() < 0.5) {
                data[idx] = Math.min(255, Math.max(0, data[idx] + 40));
                data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] - 30));
                data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + 40));
              } else {
                var r = dcR + rotDrift + Math.round((data[idx] - dcR) / qStep) * qStep;
                var g = dcG + rotDrift + Math.round((data[idx + 1] - dcG) / qStep) * qStep;
                var b = dcB + rotDrift + Math.round((data[idx + 2] - dcB) / qStep) * qStep;
                data[idx] = Math.min(255, Math.max(0, r));
                data[idx + 1] = Math.min(255, Math.max(0, g));
                data[idx + 2] = Math.min(255, Math.max(0, b));
              }
            }
          }
        }
      }
    }
    return imageData;
  };

  // 2. mosquitoRings: Gibbs cosine halo injection around contrast edges
  gleech.mosquitoRings = function mosquitoRings(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      ringRadius = Math.max(1, Math.round(getOpt(options, 'radius', null, 5))),
      intensityVal = getOpt(options, 'intensity', null, 45);
    for (var y = 2; y < height - 2; y += 2) {
      for (var x = 2; x < width - 2; x += 2) {
        var idx = (y * width + x) * 4;
        var lumC = copy[idx] * 0.299 + copy[idx + 1] * 0.587 + copy[idx + 2] * 0.114;
        var lumR = copy[idx + 4] * 0.299 + copy[idx + 5] * 0.587 + copy[idx + 6] * 0.114;
        var lumD = copy[idx + width * 4] * 0.299 + copy[idx + width * 4 + 1] * 0.587 + copy[idx + width * 4 + 2] * 0.114;
        var grad = Math.abs(lumR - lumC) + Math.abs(lumD - lumC);

        if (grad > 40) {
          for (var r = 1; r <= ringRadius; r++) {
            var wave = Math.cos(r * 1.7) * Math.exp(-r * 0.35) * intensityVal;
            if (x + r < width) {
              var tidx = (y * width + (x + r)) * 4;
              data[tidx] = Math.min(255, Math.max(0, data[tidx] + wave));
              data[tidx + 1] = Math.min(255, Math.max(0, data[tidx + 1] + wave * 0.8));
              data[tidx + 2] = Math.min(255, Math.max(0, data[tidx + 2] - wave));
            }
            if (y + r < height) {
              var tidx2 = ((y + r) * width + x) * 4;
              data[tidx2] = Math.min(255, Math.max(0, data[tidx2] - wave * 0.7));
              data[tidx2 + 1] = Math.min(255, Math.max(0, data[tidx2 + 1] + wave));
              data[tidx2 + 2] = Math.min(255, Math.max(0, data[tidx2 + 2] + wave * 0.9));
            }
          }
        }
      }
    }
    return imageData;
  };

  // 3. chromaBleed420: Asymmetric YCbCr phase smear & 4:2:0 decimation
  gleech.chromaBleed420 = function chromaBleed420(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      total = width * height,
      Y = new Float32Array(total),
      Cb = new Float32Array(total),
      Cr = new Float32Array(total);

    for (var i = 0, p = 0; i < total; i++, p += 4) {
      var r = data[p], g = data[p + 1], b = data[p + 2];
      Y[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      Cb[i] = -0.168736 * r - 0.331264 * g + 0.5 * b + 128;
      Cr[i] = 0.5 * r - 0.418688 * g - 0.081312 * b + 128;
    }

    var smearOffset = Math.round(getOpt(options, 'bleed', function() { return randRange(8, 26); }));
    var mbSize = 16;

    for (var my = 0; my < height; my += mbSize) {
      for (var mx = 0; mx < width; mx += mbSize) {
        var anchorIdx = my * width + mx;
        var avgCb = Math.round(Cb[anchorIdx] / 24) * 24;
        var avgCr = Math.round(Cr[anchorIdx] / 24) * 24;

        for (var dy = 0; dy < mbSize && my + dy < height; dy++) {
          for (var dx = 0; dx < mbSize && mx + dx < width; dx++) {
            var targetX = mx + dx + smearOffset;
            if (targetX < width) {
              var tidx = (my + dy) * width + targetX;
              Cb[tidx] = avgCb;
              Cr[tidx] = avgCr;
            }
          }
        }
      }
    }

    for (var i = 0, p = 0; i < total; i++, p += 4) {
      var yVal = Y[i];
      var cbVal = Cb[i] - 128;
      var crVal = Cr[i] - 128;
      data[p] = Math.min(255, Math.max(0, yVal + 1.402 * crVal));
      data[p + 1] = Math.min(255, Math.max(0, yVal - 0.344136 * cbVal - 0.714136 * crVal));
      data[p + 2] = Math.min(255, Math.max(0, yVal + 1.772 * cbVal));
    }
    return imageData;
  };

  // 4. huffmanSlip: Entropy bitstream desync causing cascading diagonal neon shifts
  gleech.huffmanSlip = function huffmanSlip(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      mcuHeight = 8;

    for (var bandY = 0; bandY < height; bandY += mcuHeight) {
      if (Math.random() < 0.45) {
        var slipX = randFloor(Math.floor(width * 0.65));
        var channelCycle = randChoice([1, 2]);
        var slope = (Math.random() * 0.6) + 0.2;

        for (var y = bandY; y < bandY + mcuHeight && y < height; y++) {
          for (var x = slipX; x < width; x++) {
            var offset = Math.floor((x - slipX) * slope);
            var srcX = (x + offset) % width;
            var srcIdx = (y * width + srcX) * 4;
            var dstIdx = (y * width + x) * 4;

            if (channelCycle === 1) {
              data[dstIdx] = copy[srcIdx + 1];
              data[dstIdx + 1] = copy[srcIdx + 2];
              data[dstIdx + 2] = copy[srcIdx];
            } else {
              data[dstIdx] = copy[srcIdx + 2];
              data[dstIdx + 1] = copy[srcIdx];
              data[dstIdx + 2] = copy[srcIdx + 1];
            }
          }
        }
      }
    }
    return imageData;
  };

  // 5. nyquistPoison: Anti-JPEG high-frequency checkerboard / DCT torture
  gleech.nyquistPoison = function nyquistPoison(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      amp = randRange(20, 42);

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var idx = (y * width + x) * 4;
        var sign = ((x + y) % 2 === 0) ? 1 : -1;
        var r = data[idx] + sign * amp;
        var g = data[idx + 1] - sign * amp;
        var b = data[idx + 2] + sign * amp;
        data[idx] = Math.min(255, Math.max(0, r));
        data[idx + 1] = Math.min(255, Math.max(0, g));
        data[idx + 2] = Math.min(255, Math.max(0, b));
      }
    }
    return imageData;
  };

  // 6. restartMarkerDrop: RST band shearing & telemetry drop
  gleech.restartMarkerDrop = function restartMarkerDrop(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      bandH = randRange(16, 32);

    for (var y = 0; y < height; y += bandH) {
      if (Math.random() < 0.5) {
        var shift = randRange(-Math.floor(width / 4), Math.floor(width / 4));
        var tint = randChoice(['green', 'magenta', 'dcShift', 'invert']);
        var actualH = Math.min(bandH, height - y);

        for (var dy = 0; dy < actualH; dy++) {
          for (var x = 0; x < width; x++) {
            var srcX = (x - shift + width) % width;
            var srcIdx = ((y + dy) * width + srcX) * 4;
            var dstIdx = ((y + dy) * width + x) * 4;

            var r = copy[srcIdx];
            var g = copy[srcIdx + 1];
            var b = copy[srcIdx + 2];

            if (tint === 'green') {
              r = Math.floor(r * 0.2);
              g = Math.min(255, g + 80);
              b = Math.floor(b * 0.3);
            } else if (tint === 'magenta') {
              r = Math.min(255, r + 80);
              g = Math.floor(g * 0.2);
              b = Math.min(255, b + 90);
            } else if (tint === 'dcShift') {
              r = (r + 70) % 256;
              g = (g + 70) % 256;
              b = (b + 70) % 256;
            } else if (tint === 'invert') {
              r = 255 - r;
              g = 255 - g;
              b = 255 - b;
            }

            data[dstIdx] = r;
            data[dstIdx + 1] = g;
            data[dstIdx + 2] = b;
          }
        }
      }
    }
    return imageData;
  };

  // 7. quantizeCrush: Hostile quantization matrix / high-frequency amplification
  gleech.quantizeCrush = function quantizeCrush(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      blockSize = 8;

    for (var by = 0; by < height; by += blockSize) {
      for (var bx = 0; bx < width; bx += blockSize) {
        var dcR = 0, dcG = 0, dcB = 0, count = 0;
        for (var py = 0; py < blockSize && by + py < height; py++) {
          for (var px = 0; px < blockSize && bx + px < width; px++) {
            var idx = ((by + py) * width + (bx + px)) * 4;
            dcR += copy[idx];
            dcG += copy[idx + 1];
            dcB += copy[idx + 2];
            count++;
          }
        }
        if (count === 0) continue;
        dcR = Math.round(dcR / count / 48) * 48;
        dcG = Math.round(dcG / count / 48) * 48;
        dcB = Math.round(dcB / count / 48) * 48;

        for (var py = 0; py < blockSize && by + py < height; py++) {
          for (var px = 0; px < blockSize && bx + px < width; px++) {
            var idx = ((by + py) * width + (bx + px)) * 4;
            var hfR = (copy[idx] - dcR) * 2.6;
            var hfG = (copy[idx + 1] - dcG) * 2.6;
            var hfB = (copy[idx + 2] - dcB) * 2.6;

            data[idx] = Math.min(255, Math.max(0, dcR + hfR));
            data[idx + 1] = Math.min(255, Math.max(0, dcG + hfG));
            data[idx + 2] = Math.min(255, Math.max(0, dcB + hfB));
          }
        }
      }
    }
    return imageData;
  };

  // 8. subsamplingShear: Macroblock chrominance skew / streak
  gleech.subsamplingShear = function subsamplingShear(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      sliceH = 4;

    for (var y = 0; y < height; y += sliceH) {
      if (Math.random() < 0.6) {
        var shift = randRange(8, 40) * (coinToss() ? 1 : -1);
        var actualH = Math.min(sliceH, height - y);

        for (var dy = 0; dy < actualH; dy++) {
          for (var x = 0; x < width; x++) {
            var targetX = (x + shift + width) % width;
            var srcIdx = ((y + dy) * width + x) * 4;
            var tgtIdx = ((y + dy) * width + targetX) * 4;

            var lumTgt = 0.299 * data[tgtIdx] + 0.587 * data[tgtIdx + 1] + 0.114 * data[tgtIdx + 2];
            var rDiff = data[srcIdx] - (0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2]);
            var bDiff = data[srcIdx + 2] - (0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2]);

            data[tgtIdx] = Math.min(255, Math.max(0, lumTgt + rDiff));
            data[tgtIdx + 2] = Math.min(255, Math.max(0, lumTgt + bDiff));
          }
        }
      }
    }
    return imageData;
  };

  // 9. ghostBlocks: Interleaved MCU memory leak / macroblock cache corruption
  gleech.ghostBlocks = function ghostBlocks(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      numBlocks = randRange(20, 50);

    for (var n = 0; n < numBlocks; n++) {
      var size = randChoice([8, 16]);
      var srcX = randFloor(Math.max(1, width - size));
      var srcY = randFloor(Math.max(1, height - size));
      var dstX = randFloor(Math.max(1, width - size));
      var dstY = randFloor(Math.max(1, height - size));
      var blendMode = randChoice(['xor', 'inv', 'swap']);

      for (var dy = 0; dy < size && dstY + dy < height && srcY + dy < height; dy++) {
        for (var dx = 0; dx < size && dstX + dx < width && srcX + dx < width; dx++) {
          var sIdx = ((srcY + dy) * width + (srcX + dx)) * 4;
          var dIdx = ((dstY + dy) * width + (dstX + dx)) * 4;

          if (blendMode === 'xor') {
            data[dIdx] = data[dIdx] ^ copy[sIdx];
            data[dIdx + 1] = data[dIdx + 1] ^ copy[sIdx + 1];
            data[dIdx + 2] = data[dIdx + 2] ^ copy[sIdx + 2];
          } else if (blendMode === 'inv') {
            data[dIdx] = 255 - copy[sIdx];
            data[dIdx + 1] = 255 - copy[sIdx + 1];
            data[dIdx + 2] = 255 - copy[sIdx + 2];
          } else {
            data[dIdx] = copy[sIdx + 1];
            data[dIdx + 1] = copy[sIdx + 2];
            data[dIdx + 2] = copy[sIdx];
          }
        }
      }
    }
    return imageData;
  };

  /***************************************************
   * Analog TV & CRT Glitches
   ***************************************************/

  // 10. vcrTracking: Horizontal tear, head-switching noise burst & tracking skew
  gleech.vcrTracking = function vcrTracking(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      bandHeight = Math.floor(height * (Math.random() * 0.15 + 0.1)),
      startAtBottom = coinToss(),
      startY = startAtBottom ? height - bandHeight : 0,
      maxSkew = randRange(25, 65);

    for (var y = startY; y < startY + bandHeight && y < height; y++) {
      var progress = (y - startY) / bandHeight;
      var skew = Math.floor(Math.pow(progress, 2.2) * maxSkew);
      var isSnowLine = Math.random() < 0.35;

      for (var x = 0; x < width; x++) {
        var dstIdx = (y * width + x) * 4;
        if (isSnowLine && Math.random() < 0.6) {
          var noiseVal = Math.random() < 0.5 ? 255 : (Math.random() < 0.5 ? 0 : 128);
          data[dstIdx] = noiseVal;
          data[dstIdx + 1] = noiseVal;
          data[dstIdx + 2] = noiseVal;
        } else {
          var srcX = (x + skew) % width;
          var srcIdx = (y * width + srcX) * 4;
          data[dstIdx] = copy[srcIdx];
          data[dstIdx + 1] = Math.min(255, copy[srcIdx + 1] + 25);
          data[dstIdx + 2] = Math.max(0, copy[srcIdx + 2] - 25);
        }
      }
    }
    return imageData;
  };

  // 11. verticalHold: V-Hold sync slip / rolling black blanking bar + retrace lines
  gleech.verticalHold = function verticalHold(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      rollOffset = randRange(Math.floor(height * 0.2), Math.floor(height * 0.8)),
      vbiHeight = randRange(18, 32);

    for (var y = 0; y < height; y++) {
      var targetY = (y + rollOffset) % height;
      for (var x = 0; x < width; x++) {
        var sIdx = (y * width + x) * 4;
        var dIdx = (targetY * width + x) * 4;
        data[dIdx] = copy[sIdx];
        data[dIdx + 1] = copy[sIdx + 1];
        data[dIdx + 2] = copy[sIdx + 2];
      }
    }

    var vbiTop = rollOffset;
    for (var vy = vbiTop; vy < vbiTop + vbiHeight; vy++) {
      var row = vy % height;
      var isSyncPulse = (vy - vbiTop) < 4;
      var isTeletext = (vy - vbiTop) === 8 || (vy - vbiTop) === 12;

      for (var x = 0; x < width; x++) {
        var idx = (row * width + x) * 4;
        if (isSyncPulse) {
          data[idx] = 8;
          data[idx + 1] = 8;
          data[idx + 2] = 8;
        } else if (isTeletext && (Math.floor(x / 8) % 2 === 0)) {
          data[idx] = 230;
          data[idx + 1] = 230;
          data[idx + 2] = 230;
        } else {
          data[idx] = 22;
          data[idx + 1] = 26;
          data[idx + 2] = 22;
        }
      }
    }
    return imageData;
  };

  // 12. antennaGhost: Multipath RF reflections / ghost echoes
  gleech.antennaGhost = function antennaGhost(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      numGhosts = randRange(1, 3);

    for (var g = 1; g <= numGhosts; g++) {
      var delayX = randRange(12 * g, 24 * g);
      var attenuation = 0.45 / g;

      for (var y = 0; y < height; y++) {
        for (var x = 0; x < width; x++) {
          if (x >= delayX) {
            var sIdx = (y * width + (x - delayX)) * 4;
            var dIdx = (y * width + x) * 4;
            data[dIdx] = Math.min(255, data[dIdx] + copy[sIdx] * attenuation);
            data[dIdx + 1] = Math.min(255, data[dIdx + 1] + copy[sIdx + 1] * attenuation * 0.95);
            data[dIdx + 2] = Math.min(255, data[dIdx + 2] + copy[sIdx + 2] * attenuation * 1.1);
          }
        }
      }
    }
    return imageData;
  };

  // 13. interlaceJitter: Comb field misregistration between odd/even scanlines
  gleech.interlaceJitter = function interlaceJitter(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      jitterShift = randRange(6, 18);

    for (var y = 0; y < height; y++) {
      var isOddField = (y % 2 === 1);
      var shift = isOddField ? jitterShift : 0;

      for (var x = 0; x < width; x++) {
        var srcX = (x + shift) % width;
        var sIdx = (y * width + srcX) * 4;
        var dIdx = (y * width + x) * 4;

        data[dIdx] = copy[sIdx];
        data[dIdx + 1] = copy[sIdx + 1];
        data[dIdx + 2] = copy[sIdx + 2];
      }
    }
    return imageData;
  };

  /***************************************************
   * Digital TV & Broadcast Glitches
   ***************************************************/

  // 14. tsPacketLoss: MPEG Transport Stream drop / neon green & magenta blocks
  gleech.tsPacketLoss = function tsPacketLoss(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      mbSize = 16,
      numCorruptRuns = randRange(3, 8);

    for (var r = 0; r < numCorruptRuns; r++) {
      var mbY = randFloor(Math.floor(height / mbSize)) * mbSize;
      var mbX = randFloor(Math.floor(width / mbSize)) * mbSize;
      var runLength = randRange(2, 6);
      var fallbackColor = randChoice(['neonGreen', 'magenta', 'stripe']);

      for (var run = 0; run < runLength && mbX + run * mbSize < width; run++) {
        var curX = mbX + run * mbSize;
        for (var py = 0; py < mbSize && mbY + py < height; py++) {
          for (var px = 0; px < mbSize && curX + px < width; px++) {
            var idx = ((mbY + py) * width + (curX + px)) * 4;
            if (fallbackColor === 'neonGreen') {
              data[idx] = 16;
              data[idx + 1] = 235;
              data[idx + 2] = 32;
            } else if (fallbackColor === 'magenta') {
              data[idx] = 215;
              data[idx + 1] = 25;
              data[idx + 2] = 210;
            } else {
              var stripe = (py % 4 < 2) ? 240 : 15;
              data[idx] = stripe;
              data[idx + 1] = 255 - stripe;
              data[idx + 2] = stripe;
            }
          }
        }
      }
    }
    return imageData;
  };

  // 15. macroblockFreeze: Temporal motion-vector smear / P-frame freeze
  gleech.macroblockFreeze = function macroblockFreeze(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      mbSize = 16,
      numFreezes = randRange(3, 7);

    for (var f = 0; f < numFreezes; f++) {
      var srcMbX = randFloor(Math.max(1, Math.floor(width / mbSize))) * mbSize;
      var srcMbY = randFloor(Math.max(1, Math.floor(height / mbSize))) * mbSize;
      var smearLength = randRange(3, 8);
      var horizontal = coinToss();

      for (var step = 0; step < smearLength; step++) {
        var dstMbX = horizontal ? srcMbX + step * mbSize : srcMbX;
        var dstMbY = !horizontal ? srcMbY + step * mbSize : srcMbY;
        if (dstMbX + mbSize > width || dstMbY + mbSize > height) break;

        for (var py = 0; py < mbSize; py++) {
          for (var px = 0; px < mbSize; px++) {
            var sIdx = ((srcMbY + py) * width + (srcMbX + px)) * 4;
            var dIdx = ((dstMbY + py) * width + (dstMbX + px)) * 4;
            data[dIdx] = copy[sIdx];
            data[dIdx + 1] = copy[sIdx + 1];
            data[dIdx + 2] = copy[sIdx + 2];
          }
        }
      }
    }
    return imageData;
  };

  // 16. digitalArtifacts: MPEG bitstream desync & mosaic posterization
  gleech.digitalArtifacts = function digitalArtifacts(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      blockSize = 16,
      numTiles = randRange(15, 35);

    for (var t = 0; t < numTiles; t++) {
      var bx = randFloor(Math.floor(width / blockSize)) * blockSize;
      var by = randFloor(Math.floor(height / blockSize)) * blockSize;
      var artifactType = randChoice(['bitFlip', 'mosaic', 'channelShift']);

      var avgR = 0, avgG = 0, avgB = 0, count = 0;
      for (var py = 0; py < blockSize && by + py < height; py++) {
        for (var px = 0; px < blockSize && bx + px < width; px++) {
          var idx = ((by + py) * width + (bx + px)) * 4;
          avgR += data[idx];
          avgG += data[idx + 1];
          avgB += data[idx + 2];
          count++;
        }
      }
      if (count === 0) continue;
      avgR = Math.floor(avgR / count);
      avgG = Math.floor(avgG / count);
      avgB = Math.floor(avgB / count);

      for (var py = 0; py < blockSize && by + py < height; py++) {
        for (var px = 0; px < blockSize && bx + px < width; px++) {
          var idx = ((by + py) * width + (bx + px)) * 4;
          if (artifactType === 'bitFlip') {
            data[idx] = data[idx] ^ 0x60;
            data[idx + 1] = data[idx + 1] ^ 0x30;
            data[idx + 2] = data[idx + 2] ^ 0x50;
          } else if (artifactType === 'mosaic') {
            data[idx] = avgR;
            data[idx + 1] = avgG;
            data[idx + 2] = avgB;
          } else {
            var temp = data[idx];
            data[idx] = data[idx + 1];
            data[idx + 1] = data[idx + 2];
            data[idx + 2] = temp;
          }
        }
      }
    }
    return imageData;
  };

  gleech.glitch = function glitch(imageData) {
    var hist = [];
    for (var i = 0, l = randRange(5, 10); i < l; i++) {
      switch (randFloor(13)) {
        case 0:
          imageData = gleech.focusImage(imageData);
        hist.push('focusImage');
        break;
        case 1:
          imageData = gleech.ditherBitmask(imageData);
        hist.push('ditherBitmask');
        break;
        case 2:
          imageData = (Math.random() > 0.5) ? gleech.superSlice(imageData) :
          gleech.superSlice2(imageData);
        hist.push('superSlice/2');
        break;
        case 3:
          imageData = gleech.colorShift(imageData);
        hist.push('colorShift');
        break;
        case 4:
          imageData = gleech.ditherRandom3(imageData);
        hist.push('ditherRandom3');
        break;
        case 5:
          imageData = gleech.ditherBayer3(imageData);
        hist.push('ditherBayer3');
        break;
        case 6:
          imageData = gleech.ditherAtkinsons(imageData);
        hist.push('ditherAtkinsons');
        break;
        case 7:
          imageData = gleech.ditherFloydSteinberg(imageData);
        hist.push('ditherFloydSteinberg');
        break;
        case 8:
          imageData = gleech.ditherHalftone(imageData);
        hist.push('ditherHalftone');
        break;
        case 9:
          imageData = gleech.dither8Bit(imageData);
        hist.push('dither8bit');
        break;
        case 10:
          if (coinToss()) {
          var picker = randFloor(3);
          if (picker == 1) {
            imageData = gleech.redShift(imageData);
            hist.push('redShift');
          } else if (picker == 2) {
            imageData = gleech.greenShift(imageData);
            hist.push('greenShift');
          } else {
            imageData = gleech.blueShift(imageData);
            hist.push('blueShift');
          }
        }
        break;
        /*
           case 11:
           imageData = (Math.random()>0.5) ? fractalGhosts(imageData) :
           fractalGhosts2(imageData);
           hist.push('fractalGhosts/2');
           break;
           */
        default:
        imageData = gleech.invert(imageData);
        hist.push('invert');
        break;
      }
    }
    console.log('glitch history', hist);
    return imageData;
  };
  return gleech;
}(typeof globalThis !== 'undefined' ? (globalThis.gleech = globalThis.gleech || {}) : {}));

export { gleech };
export default gleech;
