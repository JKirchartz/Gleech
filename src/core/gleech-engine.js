import { algorithmParams } from './algorithm-params.js';

/**
 * @file gleech-engine.js
 * @module gleech
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Core procedural glitch, dithering, and image manipulation engine.
 * Functions operate in-place on raw RGBA ImageData buffers (Uint8ClampedArray).
 * Stride formula: index = (y * width + x) * 4 [R, G, B, A].
 * For fast 32-bit pixel operations, cast to Uint32Array (0xAABBGGRR on little-endian).
 */

var gleech = (function(gleech) {
  'use strict';
  var imageData, originalImageData;

  /**
   * Algorithm categories grouping all 68 glitch filters.
   * @type {Object.<string, string[]>}
   */
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

  /**
   * Master list of all 68 algorithm names.
   * @type {string[]}
   */
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

  /**
   * Initializes Gleech with an active ImageData instance.
   * Stores a copy of original data for non-destructive resetting.
   *
   * @param {ImageData} data - HTML5 canvas ImageData instance
   * @returns {Object} gleech instance
   * @throws {Error} When data is not an ImageData instance
   */
  gleech.init = function init(data) {
    if ( data.toString() !== "[object ImageData]" ) {
      throw new Error('Gleech expects ImageData');
    } else {
      gleech.imageData = data;
      gleech.originalImageData = data;
    }
    return this;
  };

  /* --- Core Helpers & Comparators --- */
  function pushErr(data, idx, errs, fraction) {
    data[idx]     = data[idx]     + fraction * errs[0];
    data[idx + 1] = data[idx + 1] + fraction * errs[1];
    data[idx + 2] = data[idx + 2] + fraction * errs[2];
  }
  var n = pushErr;

  function getOpt(options, key, autoFallback, defaultVal) {
    if (options != null) {
      if (typeof options === 'object') {
        if (options[key] !== undefined && options[key] !== 'auto' && options[key] !== '') {
          var val = options[key];
          if (typeof defaultVal === 'number' || (typeof autoFallback === 'function' && typeof autoFallback() === 'number')) {
            var num = Number(val);
            if (!isNaN(num)) return num;
          }
          if (typeof defaultVal === 'boolean') {
            if (typeof val === 'boolean') return val;
            if (typeof val === 'string') return val === 'true' || val === '1';
          }
          return val;
        }
      } else if ((typeof options === 'number' || typeof options === 'boolean' || typeof options === 'string') && options !== 'auto') {
        var nVal = Number(options);
        return isNaN(nVal) ? options : nVal;
      }
    }
    return typeof autoFallback === 'function' ? autoFallback() : defaultVal;
  }
  var r = getOpt;

  function randFloor(max) { return Math.floor(Math.random() * max); }
  var i = randFloor;

  function randRound(max) { return Math.round(Math.random() * max); }
  var a = randRound;

  function randRange(min, max) { return Math.round(Math.random() * max) + min; }
  var o = randRange;

  function coinToss() { return Math.random() > 0.5; }
  var s = coinToss;

  function randomPair(min, max) {
    var first = Math.round(randRange(min, max));
    return [first, Math.round(randRange(first, max))];
  }
  var c = randomPair;

  function sortedRandomPair(min, max) {
    var p1 = Math.round(randRange(min, max)),
      p2 = Math.round(randRange(min, max));
    return p1 < p2 ? [p1, p2] : [p2, p1];
  }
  var l = sortedRandomPair;

  function randChoice(arr) { return arr[randFloor(arr.length)]; }
  var u = randChoice;

  function chance(percentage) { return Math.random() < (percentage / 100); }
  var d = chance;

  function leftSort(first, second) { return parseInt(first, 10) - parseInt(second, 10); }
  var f = leftSort;

  function rightSort(first, second) { return parseInt(second, 10) - parseInt(first, 10); }
  var p = rightSort;

  var t = gleech;


  /**
   * Returns unchanged image data buffer.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Unmodified image data
   */
  gleech.original = function original(e){return e};

  /**
   * Block-averaged 8-bit color quantization.
   * Averages NxN pixel clusters and thresholds each RGB channel to 0 or 255.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number|string} [options.size=4] - Cluster block size in pixels
   * @returns {ImageData} Mutated image data
   */
  gleech.dither8Bit = function dither8Bit(e,t){for(var n=e.width,i=e.height,a=e.data,o=Math.max(1,Math.round(r(t,`size`,null,4))),s,c,l,u,d,f,p=0;p<i;p+=o)for(var m=0;m<n;m+=o){s=0,c=0,l=0;for(var h=0,g,_;h<o;h++)for(g=0;g<o;g++)_=4*(n*(p+h)+(m+g)),s+=a[_],c+=a[_+1],l+=a[_+2];for(u=s/(o*o)>127?255:0,d=c/(o*o)>127?255:0,f=l/(o*o)>127?255:0,h=0;h<o;h++)for(g=0;g<o;g++)_=4*(n*(p+h)+(m+g)),a[_]=u,a[_+1]=d,a[_+2]=f}return e};

  /**
   * 3x3 halftone dot screen dithering.
   * Simulates CMYK newsprint rotogravure dot density based on cluster luminance.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number|string} [options.size=3] - Dot grid size
   * @returns {ImageData} Mutated image data
   */
  gleech.ditherHalftone = function ditherHalftone(e,t){var n=e.width,i=e.height,a=e.data;Math.max(2,Math.round(r(t,`size`,null,3)));for(var o=0;o<=i-2;o+=3)for(var s=0;s<=n-2;s+=3){for(var c=0,l=0,u=0,d=[],f=0,p=0;p<3;p++)for(var m=0;m<3;m++){var h=4*(n*(o+p)+(s+m));c+=a[h],l+=a[h+1],u+=a[h+2],a[h]=a[h+1]=a[h+2]=255,d.push(h),f++}var g=c/9>127?255:0,_=l/9>127?255:0,v=u/9>127?255:0,y=(g+_+v)/3,b=Math.round(y*9/255);b<9&&(a[d[4]]=g,a[d[4]+1]=_,a[d[4]+2]=v),b<8&&(a[d[5]]=g,a[d[5]+1]=_,a[d[5]+2]=v),b<7&&(a[d[1]]=g,a[d[1]+1]=_,a[d[1]+2]=v),b<6&&(a[d[6]]=g,a[d[6]+1]=_,a[d[6]+2]=v),b<5&&(a[d[3]]=g,a[d[3]+1]=_,a[d[3]+2]=v),b<4&&(a[d[8]]=g,a[d[8]+1]=_,a[d[8]+2]=v),b<3&&(a[d[2]]=g,a[d[2]+1]=_,a[d[2]+2]=v),b<2&&(a[d[0]]=g,a[d[0]+1]=_,a[d[0]+2]=v),b<1&&(a[d[7]]=g,a[d[7]+1]=_,a[d[7]+2]=v)}return e};

  /**
   * Atkinson error-diffusion dithering (Bill Atkinson / Apple MacPaint).
   * Diffuses 3/4 of quantization error to 6 neighboring pixels, preserving specular whites.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.threshold=128] - Luminance cutoff threshold (0-255)
   * @returns {ImageData} Mutated image data
   */
  gleech.ditherAtkinsons = function ditherAtkinsons(e,t){for(var i=e.width,a=e.height,o=e.data,s=r(t,`threshold`,null,128),c=0;c<a;c++)for(var l=0;l<i;l++){var u=4*(c*i+l),d=o[u],f=o[u+1],p=o[u+2],m=d>s?255:0,h=f>s?255:0,g=p>s?255:0;o[u]=m,o[u+1]=h,o[u+2]=g;var _=d-m,v=f-h,y=p-g,b=0;l<i-1&&(b=u+4,n(o,b,[_,v,y],1/8),c<a-1&&(b=b+i*4+4,n(o,b,[_,v,y],1/8)),l<i-2&&(b=u+8,n(o,b,[_,v,y],1/8))),c<a-1&&(b=u+i*4,n(o,b,[_,v,y],1/8),l>0&&(b-=4,n(o,b,[_,v,y],1/8)),c<a-2&&(b=u+2*i*4,n(o,b,[_,v,y],1/8)))}return e};

  /**
   * Floyd-Steinberg error-diffusion dithering.
   * Distributes 100% of quantization residual error to 4 forward neighbor pixels (7/16, 3/16, 5/16, 1/16).
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.threshold=128] - Luminance cutoff threshold (0-255)
   * @returns {ImageData} Mutated image data
   */
  gleech.ditherFloydSteinberg = function ditherFloydSteinberg(e,t){for(var i=e.width,a=e.height,o=e.data,s=r(t,`threshold`,null,128),c=0;c<a;c++)for(var l=0;l<i;l++){var u=4*(c*i+l),d=o[u],f=o[u+1],p=o[u+2],m=d>s?255:0,h=f>s?255:0,g=p>s?255:0;o[u]=m,o[u+1]=h,o[u+2]=g;var _=d-m,v=f-h,y=p-g,b=0,x=0,S=0,C=0;l<i-1&&(b=u+4,n(o,b,[_,v,y],7/16),c<a-1&&(C=b+i*4,n(o,C,[_,v,y],1/16))),c<a-1&&(x=u+i*4,n(o,x,[_,v,y],5/16),l>0&&(S=x-4,n(o,S,[_,v,y],3/16)))}return e};

  /**
   * Bayer matrix ordered threshold dithering (monochrome).
   * Uses recursive 2x2, 3x3, 4x4, or 8x8 index matrices to eliminate banding without error diffusion.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number|string} [options.mapIndex] - Threshold matrix preset index
   * @returns {ImageData} Mutated image data
   */
  gleech.ditherBayer = function ditherBayer(e,t){for(var n=e.width,a=e.height,o=e.data,s=[[[3,7,4],[6,1,9],[2,8,5]],[[1,9,3,11],[13,5,15,7],[4,12,2,10],[16,8,14,6]],[[1,49,13,61,4,52,16,64],[33,17,45,29,36,20,48,32],[9,57,5,53,12,60,8,56],[41,25,37,21,44,28,40,24],[3,51,15,63,2,50,14,62],[35,19,47,31,34,18,46,30],[11,59,7,55,10,58,6,54],[43,27,39,23,42,26,38,22]]],c=r(t,`mapIndex`,function(){return i(s.length)}),l=s[Math.abs(c)%s.length],u=l.length,d=0;d<a;d++)for(var f=0;f<n;f++){var p=4*(d*n+f),m=(.3*o[p]+.59*o[p+1]+.11*o[p+2])*17/255<l[f%u][d%u]?0:255;o[p]=o[p+1]=o[p+2]=m}return e};

  /**
   * Bayer 3-bit RGB ordered threshold dithering.
   * Quantizes red, green, and blue color channels independently against spatial threshold matrices.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number|string} [options.mapIndex] - Threshold matrix preset index
   * @returns {ImageData} Mutated image data
   */
  gleech.ditherBayer3 = function ditherBayer3(e,t){for(var n=e.width,a=e.height,o=e.data,s=[[[3,7,4],[6,1,9],[2,8,5]],[[1,9,3,11],[13,5,15,7],[4,12,2,10],[16,8,14,6]],[[1,49,13,61,4,52,16,64],[33,17,45,29,36,20,48,32],[9,57,5,53,12,60,8,56],[41,25,37,21,44,28,40,24],[3,51,15,63,2,50,14,62],[35,19,47,31,34,18,46,30],[11,59,7,55,10,58,6,54],[43,27,39,23,42,26,38,22]]],c=r(t,`mapIndex`,function(){return i(s.length)}),l=s[Math.abs(c)%s.length],u=l.length,d=0;d<a;d++)for(var f=0;f<n;f++){var p=4*(d*n+f);o[p]=o[p]*17/255<l[f%u][d%u]?0:255,o[p+1]=o[p+1]*17/255<l[f%u][d%u]?0:255,o[p+2]=o[p+2]*17/255<l[f%u][d%u]?0:255}return e};

  /**
   * Stochastic white noise dithering.
   * Compares average pixel luminance against random noise thresholds for organic film grain.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.threshold] - Noise threshold limit (0-255)
   * @returns {ImageData} Mutated image data
   */
  gleech.ditherRandom = function ditherRandom(e,t){for(var n=e.width,i=e.height,o=e.data,s=r(t,`threshold`,null,null),c=0,l,u,d=n*i*4;c<d;c+=4)u=(o[c]+o[c+1]+o[c+2])/3%255,l=u<(s??a(128))?0:255,o[c]=o[c+1]=o[c+2]=l;return e};

  /**
   * Stochastic 3-bit RGB white noise dithering.
   * Compares each color channel independently against stochastic noise thresholds.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.threshold] - Noise threshold limit (0-255)
   * @returns {ImageData} Mutated image data
   */
  gleech.ditherRandom3 = function ditherRandom3(e,t){for(var n=e.width,i=e.height,o=e.data,s=r(t,`threshold`,null,null),c=0,l=n*i*4;c<l;c+=4){var u=s??a(128);o[c]=o[c]<u?0:255,o[c+1]=o[c+1]<u?0:255,o[c+2]=o[c+2]<u?0:255}return e};

  /**
   * Bitwise logical OR masking across color channels.
   * Forces selected bit planes high, producing stepped chromatic quantization.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.mask] - Bitmask integer applied via bitwise OR
   * @returns {ImageData} Mutated image data
   */
  gleech.ditherBitmask = function ditherBitmask(e,t){for(var n=e.width,i=e.height,a=e.data,s=Math.round(r(t,`mask`,function(){return o(1,125)})),c=0,l=n*i*4;c<l;c+=4)a[c]|=s,a[c+1]|=s,a[c+2]|=s;return e};

  /**
   * Cyclic RGB channel permutation.
   * Rotates color values across channels (R->G, G->B, B->R).
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {string} [options.mode='random'] - Rotation direction ('forward', 'reverse', 'random')
   * @returns {ImageData} Mutated image data
   */
  gleech.colorShift = function colorShift(e,t){for(var n=e.width,i=e.height,a=e.data,o=r(t,`mode`,null,`random`),c=o===`forward`||o!==`reverse`&&s(),l=0,u=n*i*4;l<u;l+=4){var d=a[l],f=a[l+1],p=a[l+2];a[l]=c?f:p,a[l+1]=c?p:d,a[l+2]=c?d:f}return e};

  /**
   * Fast 32-bit integer channel rotation.
   * Permutes packed ARGB byte lanes using bitwise shift and mask operations.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {string} [options.mode='random'] - Rotation direction
   * @returns {ImageData} Mutated image data
   */
  gleech.colorShift2 = function colorShift2(e,t){e.width,e.height;for(var n=new Uint32Array(e.data.buffer),i=r(t,`mode`,null,`random`),a=i===`forward`||i!==`reverse`&&s(),o=0,c=n.length;o<c;o++){var l=n[o]>>24&255,u=n[o]>>16&255,d=n[o]>>8&255,f=n[o]&255;u=(a?d:f)&255,d=(a?f:u)&255,f=(a?u:d)&255,n[o]=(l<<24)+(u<<16)+(d<<8)+f}return e};

  /**
   * Selective green color spectrum boost and complementary channel subtraction.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.amount] - Shift offset (1-128)
   * @returns {ImageData} Mutated image data
   */
  gleech.greenShift = function greenShift(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data;
    var shift = Math.max(1, Math.round(getOpt(options, 'amount', function() {
      return randRange(1, 64);
    })));
    for (var i = 0, len = width * height * 4; i < len; i += 4) {
      var boosted = data[i + 1] + shift;
      data[i]     -= shift;
      data[i + 1] = boosted > 255 ? 255 : boosted;
      data[i + 2] -= shift;
    }
    return imageData;
  };

  /**
   * Selective red color spectrum boost and complementary channel subtraction.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.amount] - Shift offset (1-128)
   * @returns {ImageData} Mutated image data
   */
  gleech.redShift = function redShift(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data;
    var shift = Math.max(1, Math.round(getOpt(options, 'amount', function() {
      return randRange(1, 64);
    })));
    for (var i = 0, len = width * height * 4; i < len; i += 4) {
      var boosted = data[i] + shift;
      data[i]     = boosted > 255 ? 255 : boosted;
      data[i + 1] -= shift;
      data[i + 2] -= shift;
    }
    return imageData;
  };

  /**
   * Selective blue color spectrum boost and complementary channel subtraction.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.amount] - Shift offset (1-128)
   * @returns {ImageData} Mutated image data
   */
  gleech.blueShift = function blueShift(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data;
    var shift = Math.max(1, Math.round(getOpt(options, 'amount', function() {
      return randRange(1, 64);
    })));
    for (var i = 0, len = width * height * 4; i < len; i += 4) {
      var boosted = data[i + 2] + shift;
      data[i]     -= shift;
      data[i + 1] -= shift;
      data[i + 2] = boosted > 255 ? 255 : boosted;
    }
    return imageData;
  };

  /**
   * Cascading iterative color channel rotation passes.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.shift] - Number of colorShift passes
   * @returns {ImageData} Mutated image data
   */
  gleech.superShift = function superShift(imageData, options) {
    var mode = getOpt(options, 'mode', null, coinToss() ? 'forward' : 'reverse');
    var shiftCount = Math.max(1, Math.round(getOpt(options, 'shift', function() {
      return (Math.random() < 0.5) ? 1 : 2;
    })));
    if (shiftCount % 3 === 0) shiftCount = 1;
    var shiftOpts = { mode: mode };
    for (var i = 0; i < shiftCount; i++) {
      imageData = gleech.colorShift(imageData, shiftOpts);
    }
    return imageData;
  };

  /**
   * Diagnostic color palette sampler logging hex color integers.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Unmodified image data
   */
  gleech.getColors = function getColors(e){var t=new Uint32Array(e.data.buffer);e.height,e.width,console.log(t[0].toString(16)),console.log((~t[0]|4278190080).toString(16));for(var n=8;n--;)console.log(u(t).toString(16));return e};

  /**
   * Clustered mosaic decimation with primary color tinting.
   * Downsamples random rectangular regions and applies selective color masks.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.pixelation] - Block size in pixels
   * @param {number} [options.chance=50] - Probability percentage per block
   * @param {string} [options.color='random'] - Tint channel ('red', 'green', 'blue', 'random')
   * @returns {ImageData} Mutated image data
   */
  gleech.superPixelFunk = function superPixelFunk(e,t){for(var n=new Uint32Array(e.data.buffer),i=e.height,a=e.width,c=Math.max(1,Math.round(r(t,`pixelation`,function(){return o(2,15)}))),l=r(t,`chance`,null,50),f=r(t,`color`,null,`random`),p=0;p<i;p+=c)for(var m=0;m<a;m+=c)if(d(l)){for(var h=s(),g=f===`red`?16711680:f===`green`?65280:f===`blue`?255:u([16711680,65280,255]),_=s()?p*a+m:p*a+(m-c*2),v=0;v<c;v++)for(var y=0;y<c;y++)if(m+y<a){var b=a*(p+v)+(m+y);n[b]=h?n[_]:n[b]|g}}return e};

  /**
   * Stochastic mosaic decimation.
   * Clones seed pixels across NxN square regions to create chunky mosaic artifacts.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.pixelation] - Block size in pixels
   * @param {number} [options.chance=50] - Probability percentage per block
   * @returns {ImageData} Mutated image data
   */
  gleech.pixelFunk = function pixelFunk(e,t){for(var n=new Uint32Array(e.data.buffer),i=e.height,a=e.width,s=Math.max(1,Math.round(r(t,`pixelation`,function(){return o(2,10)}))),c=r(t,`chance`,null,50),l=0;l<i;l+=s)for(var u=0;u<a;u+=s)if(d(c)){for(var f=l*a+u,p=0;p<s;p++)for(var m=0;m<s;m++)if(u+m<a){var h=a*(l+p)+(u+m);n[h]=n[f]}}return e};

  /**
   * Coarse block sampling simulating focal blur degradation.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.radius] - Block radius in pixels
   * @returns {ImageData} Mutated image data
   */
  gleech.focusImage = function focusImage(e,t){for(var n=new Uint32Array(e.data.buffer),i=e.height,a=e.width,s=Math.max(1,Math.round(r(t,`radius`,function(){return o(2,10)}))),c=0;c<i;c+=s)for(var l=0;l<a;l+=s)for(var u=c*a+l,d=0;d<s;d++)for(var f=0;f<s;f++)if(l+f<a){var p=a*(c+d)+(l+f);n[p]=n[u]}return e};

  /**
   * Contiguous byte buffer segment displacement.
   * Copies slices of raw image bytes and writes them to stochastic buffer offsets.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.slices=1] - Number of displaced buffer slices
   * @returns {ImageData} Mutated image data
   */
  gleech.slice = function slice(e,t){for(var n=e.width,a=e.height,o=e.data,s=Math.max(1,Math.round(r(t,`slices`,null,1))),c=0;c<s;c++){var l=i(n*a*4),u=Math.floor(l/1.7),d=o.subarray(u,l);o.set(d,i(n*a*4-d.length))}return e.data.set(o),e};

  /**
   * Fine-grained buffer slicing with stochastic length distributions.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.slices] - Number of slice operations
   * @returns {ImageData} Mutated image data
   */
  gleech.slice2 = function slice2(e,t){for(var n=e.width,o=e.height,s=e.data,c=Math.max(1,Math.round(r(t,`slices`,function(){return a(11)}))),l=0;l<c;l++){var u=Math.random()<.75?i(n*o*4):n*o*4,d=Math.floor(u/1.7),f=s.subarray(d,u);s.set(f,i(n*o*4-f.length))}return e.data.set(s),e};

  /**
   * Large-offset contiguous buffer slicing.
   * Displaces fixed-range memory blocks across wide buffer distances.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.slices] - Number of slice operations
   * @returns {ImageData} Mutated image data
   */
  gleech.slice3 = function slice3(e,t){for(var n=e.width,s=e.height,c=e.data,l=Math.max(1,Math.round(r(t,`slices`,function(){return a(20)}))),u=0;u<l;u++){var d=i(n*s*4),f=d-o(1e3,5100),p=c.subarray(f,d);c.set(p,i(n*s*4-p.length))}return e.data.set(c),e};

  /**
   * Stochastic combination of slicing algorithms (slice, slice2, slice3).
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.iterations] - Number of random slice passes
   * @returns {ImageData} Mutated image data
   */
  gleech.superSlice2 = function superSlice2(e,n){for(var o=[`slice`,`slice2`,`slice3`],s=Math.max(1,Math.round(r(n,`iterations`,function(){return a(o.length)}))),c=0;c<s;c++)e=t[o[i(o.length)]](e);return e};

  /**
   * Cascading triple-slicing pipeline (slice -> slice2 -> slice3).
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.iterations] - Number of cascading iterations
   * @returns {ImageData} Mutated image data
   */
  gleech.superSlice = function superSlice(e,n){for(var i=Math.max(1,Math.round(r(n,`iterations`,function(){return o(1,10)}))),a=0;a<i;a++)e=t.slice(t.slice2(t.slice3(e)));return e};

  /**
   * Self-similar modulo feedback overlay.
   * Compares source bytes against 2x modulo positions, writing the lesser value.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.ghosts=1] - Number of feedback passes
   * @returns {ImageData} Mutated image data
   */
  gleech.fractalGhosts = function fractalGhosts(e,t){for(var n=e.data,i=Math.max(1,Math.round(r(t,`ghosts`,null,1))),a=0;a<i;a++)for(var o=0;o<n.length;o++)parseInt(n[o*2%n.length],10)<parseInt(n[o],10)&&(n[o]=n[o*2%n.length]);return e.data.set(n),e};

  /**
   * Multiplier-modulated fractal feedback overlay.
   * Uses configurable step multipliers to project recursive harmonic reflections.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.ghosts] - Feedback pass count and step multiplier
   * @returns {ImageData} Mutated image data
   */
  gleech.fractalGhosts2 = function fractalGhosts2(e,t){for(var n=e.data,i=Math.max(2,Math.round(r(t,`ghosts`,function(){return o(2,10)}))),a=0;a<n.length;a++){var s=a*i%n.length;parseInt(n[s],10)<parseInt(n[a],10)&&(n[a]=n[s])}return e.data.set(n),e};

  /**
   * Channel-isolated fractal feedback overlay.
   * Confines recursive feedback to specific RGBA byte lanes while maxing non-target lanes.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.ghosts] - Step multiplier
   * @param {number} [options.channel] - Target byte lane (0-3)
   * @returns {ImageData} Mutated image data
   */
  gleech.fractalGhosts3 = function fractalGhosts3(e,t){for(var n=e.data,i=Math.max(1,Math.round(r(t,`ghosts`,function(){return o(1,10)}))),a=Math.round(r(t,`channel`,function(){return o(0,4)})),s=0;s<n.length;s++){if(s%4===a){n[s]=255;continue}var c=s*i%n.length;parseInt(n[c],10)<parseInt(n[s],10)&&(n[s]=n[c])}return e.data.set(n),e};

  /**
   * 2x modulo harmonic feedback on isolated color channels.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.channel] - Target byte lane (0-3)
   * @returns {ImageData} Mutated image data
   */
  gleech.fractalGhosts4 = function fractalGhosts4(e,t){for(var n=e.data,i=Math.round(r(t,`channel`,function(){return o(0,4)})),a=0;a<n.length;a++){if(a%4===i){n[a]=255;continue}parseInt(n[a*2%n.length],10)<parseInt(n[a],10)&&(n[a]=n[a*2%n.length])}return e.data.set(n),e};

  /**
   * Reverse-scan 32-bit integer fractal feedback.
   * Traverses packed 32-bit pixels in reverse, feeding modulo reflections into lower values.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.passes=1] - Number of fractal passes
   * @returns {ImageData} Mutated image data
   */
  gleech.fractal = function fractal(e,t){for(var n=new Uint32Array(e.data.buffer),i=Math.max(1,Math.round(r(t,`passes`,null,1))),a=0;a<i;a++)for(var o=n.length;o;o--)parseInt(n[o*2%n.length],10)<parseInt(n[o],10)&&(n[o]=n[o*2%n.length]);return e};

  /**
   * Forward-scan 32-bit integer fractal feedback with dynamic multiplier.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.passes] - Iteration count and stride multiplier
   * @returns {ImageData} Mutated image data
   */
  gleech.fractal2 = function fractal2(e,t){for(var n=new Uint32Array(e.data.buffer),i=Math.max(2,Math.round(r(t,`passes`,function(){return o(2,8)}))),a=0;a<n.length;a++)parseInt(n[a*i%n.length],10)<parseInt(n[a],10)&&(n[a]=n[a*i%n.length]);return e};

  /**
   * Random short contiguous segment sorting.
   * Sorts 32-bit packed pixel chunks in either ascending or descending order.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.segments=1] - Number of segments to sort
   * @returns {ImageData} Mutated image data
   */
  gleech.shortsort = function shortsort(imageData, options) {
    var pixels = new Uint32Array(imageData.data.buffer);
    var segments = Math.max(1, Math.round(getOpt(options, 'segments', null, 1)));
    var sortFn = coinToss() ? leftSort : rightSort;
    for (var i = 0; i < segments; i++) {
      var range = sortedRandomPair(0, pixels.length);
      if (range[1] - range[0] < 8) {
        range[1] = Math.min(pixels.length, range[0] + 32);
      }
      var slice = Array.from(pixels.subarray(range[0], range[1]));
      slice.sort(sortFn);
      pixels.set(slice, range[0]);
    }
    return imageData;
  };

  /**
   * Fast segment sorting using default JavaScript string comparison.
   * Sorts short buffer segments using native lexicographical sorting.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.segments=1] - Number of segments to sort
   * @returns {ImageData} Mutated image data
   */
  gleech.shortdumbsort = function shortdumbsort(imageData, options) {
    var pixels = new Uint32Array(imageData.data.buffer);
    var segments = Math.max(1, Math.round(getOpt(options, 'segments', null, 1)));
    for (var i = 0; i < segments; i++) {
      var range = sortedRandomPair(0, pixels.length);
      if (range[1] - range[0] < 8) {
        range[1] = Math.min(pixels.length, range[0] + 32);
      }
      var slice = Array.from(pixels.subarray(range[0], range[1]));
      slice.sort();
      pixels.set(slice, range[0]);
    }
    return imageData;
  };

  /**
   * Full-buffer 32-bit pixel sorting.
   * Reorders all pixels in the image by packed integer value.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {string} [options.direction='auto'] - Sort direction ('left', 'right', 'auto')
   * @returns {ImageData} Mutated image data
   */
  gleech.sort = function sort(e,t){var n=new Uint32Array(e.data.buffer),i=r(t,`direction`,null,`auto`);return i===`left`?Array.prototype.sort.call(n,f):i===`right`?Array.prototype.sort.call(n,p):Array.prototype.sort.call(n,s()?f:p),e.data.set(n,0),e};

  /**
   * Segment sort with random destination buffer displacement.
   * Extracts a sorted pixel segment and writes it to a stochastic destination offset.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.iterations=1] - Sort and displace passes
   * @returns {ImageData} Mutated image data
   */
  gleech.slicesort = function slicesort(imageData, options) {
    var pixels = new Uint32Array(imageData.data.buffer);
    var iterations = Math.max(1, Math.round(getOpt(options, 'iterations', null, 1)));
    for (var i = 0; i < iterations; i++) {
      var range = sortedRandomPair(0, pixels.length);
      if (range[1] - range[0] < 2) continue;
      var slice = Array.from(pixels.subarray(range[0], range[1]));
      slice.sort(leftSort);
      var dest = randFloor(Math.max(1, pixels.length - slice.length));
      pixels.set(slice, dest);
    }
    return imageData;
  };

  /**
   * Row-by-row horizontal pixel sorting.
   * Sorts pixels within individual horizontal scanlines.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.step=1] - Row interval step
   * @returns {ImageData} Mutated image data
   */
  gleech.sortRows = function sortRows(e,t){var n=new Uint32Array(e.data.buffer),i=e.width;e.height;for(var a=Math.max(1,Math.round(r(t,`step`,null,1))),o=0,s=n.length+1;o<s;o+=i*a){var c=n.subarray(o,o+i);Array.prototype.sort.call(c,f),c.copyWithin(n,o)}return e.data.set(n.buffer),e};

  /**
   * Vertical stripe column sorting.
   * Sorts pixels within fixed horizontal window intervals down all scanlines.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.stripes=1] - Number of vertical stripe columns
   * @returns {ImageData} Mutated image data
   */
  gleech.sortStripe = function sortStripe(e,t){var n=new Uint32Array(e.data.buffer,e.data.byteOffset,e.data.byteLength/4),i=e.width,a=Math.max(1,Math.round(r(t,`stripes`,function(){return o(1,4)},1)));for(var s=0;s<a;s++){var c=Math.max(4,Math.floor(i/8)),l=Math.floor(Math.random()*Math.max(1,i-c)),u=Math.min(i,l+c+Math.floor(Math.random()*(i-l-c+1))),d=Math.random()>.5?f:p;for(var m=0,h=n.length;m<h;m+=i){var g=Math.min(h,m+u),_=Math.min(g,m+l);if(g-_>1){var v=n.subarray(_,g);Array.prototype.sort.call(v,d)}}}return e};

  /**
   * Lexicographical row sorting with probability threshold.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.chance=100] - Percentage chance to sort each row
   * @returns {ImageData} Mutated image data
   */
  gleech.dumbSortRows = function dumbSortRows(e,t){var n=new Uint32Array(e.data.buffer),i=e.width;e.height;for(var a=r(t,`chance`,null,100),o=0,s=n.length;o<s;o+=i)if(d(a)){var c=n.subarray(o,o+i);Array.prototype.sort.call(c),n.set(c,o)}return e.data.set(n.buffer),e};

  /**
   * Stochastic row sorting with coin-toss comparator.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.chance=100] - Percentage chance to sort each row
   * @returns {ImageData} Mutated image data
   */
  gleech.randomSortRows = function randomSortRows(imageData, options) {
    var pixels = new Uint32Array(imageData.data.buffer);
    var width = imageData.width;
    var rowChance = getOpt(options, 'chance', null, 100);
    for (var r = 0; r < pixels.length; r += width) {
      if (chance(rowChance)) {
        var row = Array.from(pixels.subarray(r, r + width));
        row.sort(function() { return Math.random() > 0.5 ? 1 : -1; });
        pixels.set(row, r);
      }
    }
    return imageData;
  };

  /**
   * Bitwise color inversion.
   * Inverts packed 32-bit pixel values while preserving the alpha channel.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {string} [options.channel='all'] - Target channel ('all', 'red', 'green', 'blue')
   * @returns {ImageData} Mutated image data
   */
  gleech.invert = function invert(e,t){var n=r(t,`channel`,null,`all`);if(n===`all`){for(var i=new Uint32Array(e.data.buffer),a=0;a<i.length;a++)i[a]=~i[a]|4278190080;e.data.set(i.buffer)}else for(var o=e.data,s=n===`red`?0:n===`green`?1:2,c=0;c<o.length;c+=4)o[c+s]=255-o[c+s];return e};

  /**
   * Chromatic aberration channel displacement.
   * Offsets red, green, and blue color channels horizontally to simulate prism misregistration.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.shift] - Pixel displacement offset
   * @returns {ImageData} Mutated image data
   */
  gleech.rgb_glitch = function rgb_glitch(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height;
    var copy = new Uint8ClampedArray(data);
    var shift = Math.max(1, Math.round(getOpt(options, 'shift', function() {
      return Math.floor(Math.random() * (Math.max(4, width - 4))) + 2;
    })));
    var channel = Math.floor(Math.random() * 3);
    var dir = coinToss() ? 1 : -1;

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var srcX = (x + dir * shift + width * 1000) % width;
        var srcIdx = (y * width + srcX) * 4;
        var dstIdx = (y * width + x) * 4;
        data[dstIdx + channel] = copy[srcIdx + channel];
      }
    }
    return imageData;
  };

  /**
   * Vertical sinusoidal CRT beam deflection.
   * Displaces vertical raster scanlines along a cosine trigonometric curve.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.frequency=1] - Sine wave frequency
   * @returns {ImageData} Mutated image data
   */
  gleech.DrumrollVerticalWave = function DrumrollVerticalWave(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height;
    var copy = new Uint8ClampedArray(data);
    var frequency = getOpt(options, 'frequency', function() { return 1; });
    var roll = Math.floor(height * 0.2);
    for (var x = 0; x < width; x++) {
      if (Math.random() > 0.85) {
        roll = Math.floor(Math.cos(x * frequency) * (height * 0.35));
      }
      if (Math.random() > 0.95) {
        roll = 0;
      }
      for (var y = 0; y < height; y++) {
        var dstY = (y + roll) % height;
        if (dstY < 0) dstY += height;
        var srcIdx = (y * width + x) * 4;
        var dstIdx = (dstY * width + x) * 4;
        data[dstIdx]     = copy[srcIdx];
        data[dstIdx + 1] = copy[srcIdx + 1];
        data[dstIdx + 2] = copy[srcIdx + 2];
      }
    }
    return imageData;
  };

  /**
   * Horizontal sinusoidal CRT beam deflection.
   * Displaces horizontal raster scanlines along a cosine trigonometric curve.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.frequency=1] - Sine wave frequency
   * @returns {ImageData} Mutated image data
   */
  gleech.DrumrollHorizontalWave = function DrumrollHorizontalWave(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height;
    var copy = new Uint8ClampedArray(data);
    var frequency = getOpt(options, 'frequency', function() { return 1; });
    var roll = Math.floor(width * 0.2);
    for (var y = 0; y < height; y++) {
      if (Math.random() > 0.85) {
        roll = Math.floor(Math.cos(y * frequency) * (width * 0.35));
      }
      if (Math.random() > 0.95) {
        roll = 0;
      }
      for (var x = 0; x < width; x++) {
        var dstX = (x + roll) % width;
        if (dstX < 0) dstX += width;
        var srcIdx = (y * width + x) * 4;
        var dstIdx = (y * width + dstX) * 4;
        data[dstIdx]     = copy[srcIdx];
        data[dstIdx + 1] = copy[srcIdx + 1];
        data[dstIdx + 2] = copy[srcIdx + 2];
      }
    }
    return imageData;
  };

  /**
   * Vertical raster sync desynchronization (V-SYNC tear).
   * Displaces columns vertically with stochastic slip intervals.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.rolls=1] - Roll intensity
   * @returns {ImageData} Mutated image data
   */
  gleech.DrumrollVertical = function DrumrollVertical(e,t){var n=e.data,a=e.width,o=e.height;Math.max(1,Math.round(r(t,`rolls`,null,1)));for(var s=0,c=0;c<a;c++){Math.random()>.95&&(s=i(o)),Math.random()>.95&&(s=0);for(var l=0;l<o;l++){var u=(c+l*a)*4,d=l+s;d>o-1&&(d-=o);for(var f=(c+d*a)*4,p=0;p<4;p++)n[f+p]=n[u+p]}}return e.data.set(n),e};

  /**
   * Horizontal raster sync desynchronization (H-SYNC tear).
   * Displaces scanlines horizontally with stochastic slip intervals.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.rolls=1] - Roll intensity
   * @returns {ImageData} Mutated image data
   */
  gleech.DrumrollHorizontal = function DrumrollHorizontal(imageData, options) {
    var data = imageData.data,
      width = imageData.width,
      height = imageData.height;
    var copy = new Uint8ClampedArray(data);
    var rolls = Math.max(1, Math.round(getOpt(options, 'rolls', null, 1)));
    var rollOffset = randRange(2, height - 2);
    var rollStart = randFloor(Math.max(1, width - 8));
    var rollWidth = randRange(4, Math.max(6, Math.floor(width / 2)));
    for (var x = 0; x < width; x++) {
      var shiftY = (x >= rollStart && x < rollStart + rollWidth) ? rollOffset : 0;
      if (shiftY === 0 && Math.random() < 0.08) {
        shiftY = randFloor(height);
      }
      if (shiftY !== 0) {
        for (var y = 0; y < height; y++) {
          var srcY = (y + shiftY) % height;
          var srcIdx = (srcY * width + x) * 4;
          var dstIdx = (y * width + x) * 4;
          data[dstIdx]     = copy[srcIdx];
          data[dstIdx + 1] = copy[srcIdx + 1];
          data[dstIdx + 2] = copy[srcIdx + 2];
        }
      }
    }
    return imageData;
  };

  /**
   * CRT phosphor aperture grille scanline simulation.
   * Applies bitwise masks across periodic horizontal scanline intervals.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.density] - Scanline spacing interval
   * @returns {ImageData} Mutated image data
   */
  gleech.scanlines = function scanlines(e,t){var n=new Uint32Array(e.data.buffer),i=e.width;e.height;for(var a=o(0,3),s=Math.max(1,Math.round(r(t,`density`,function(){return o(3,15)}))),c=u([5592405,4278255360,15790320,3355443]),l=u([4283782485,0xffff00ff00,4293980400,4281545523]),d=0,f=n.length;d<f;d+=i*s){var p=Array.apply([],n.subarray(d,d+i));for(var m in p)p[m]=a===0?p[m]^c:a===1?p[m]|l:~p[m]|4278190080;n.set(p,d)}return e.data.set(n.buffer),e};

  /**
   * Kim Asendorf threshold-bounded interval pixel sorting.
   * Scans rows for contiguous brightness runs between threshold bounds and sorts pixels within each run.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number} [options.threshold=128] - Luminance cutoff threshold (0-255)
   * @returns {ImageData} Mutated image data
   */
  gleech.pixelSort = function pixelSort(imageData, options) {
    var pixels = new Uint32Array(imageData.data.buffer);
    var width = imageData.width;
    var threshold = getOpt(options, 'threshold', null, 128);
    for (var r = 0; r < pixels.length; r += width) {
      var row = Array.from(pixels.subarray(r, r + width));
      var start = -1, end = -1;
      for (var x = 0; x < width; x++) {
        var val = row[x];
        var lum = ((val & 0xFF) + (val >> 8 & 0xFF) + (val >> 16 & 0xFF)) / 3;
        if (start === -1 && lum >= threshold) {
          start = x;
        } else if (start !== -1 && end === -1 && lum < threshold) {
          end = x;
          break;
        }
      }
      if (start !== -1) {
        if (end === -1) end = width;
        if (end - start > 1) {
          var slice = row.slice(start, end);
          slice.sort(leftSort);
          pixels.set(slice, r + start);
        }
      }
    }
    return imageData;
  };

  /**
   * 2D coordinate loop boilerplate template for custom spatial algorithms.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Image data
   */
  gleech.XYtemplate = function XYtemplate(e){for(var t=new Uint32Array(e.data.buffer),n=e.width,r=e.height,i=0;i<r;++i)for(var a=0;a<n;++a);return e.data.set(t.buffer),e};

  /**
   * Row-by-row iteration boilerplate template for scanline algorithms.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Image data
   */
  gleech.RowTemplate = function RowTemplate(e){var t=new Uint32Array(e.data.buffer),n=e.width;e.height;for(var r=0,i=t.length;r<i;r+=n){var a=Array.apply([],t.subarray(r,r+n));t.set(a,r)}return e.data.set(t.buffer),e};

  /**
   * Preset 1: Clustered funk, channel shifts, and Floyd-Steinberg dithering.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
  gleech.preset1 = function preset1(e){var n=[`ditherRandom3`,`shortdumbsort`,`slice`,`invert`,`shortsort`,`shortsort`,`ditherRandom3`,`DrumrollVerticalWave`,`ditherBayer3`,`dumbSortRows`,`slicesort`,`DrumrollVertical`];for(var r in n)t[n[r]](e);return e};

  /**
   * Preset 2: Slicing, RGB displacement, and CRT sine wave tearing.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
  gleech.preset2 = function preset2(e){var n=[`shortsort`,`slice2`,`fractalGhosts4`,`sort`,`fractalGhosts2`,`colorShift`];for(var r in n)t[n[r]](e);return e};

  /**
   * Preset 3: Random dithering, radial blur, and scanlines.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
  gleech.preset3 = function preset3(e){var n=[`ditherRandom3`,`focusImage`,`scanlines`];for(var r in n)t[n[r]](e);return e};

  /**
   * Preset 4: Atkinson dithering, focus blur, and noise dither.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
  gleech.preset4 = function preset4(e){var n=[`ditherAtkinsons`,`focusImage`,`ditherRandom3`,`focusImage`];for(var r in n)t[n[r]](e);return e};

  /**
   * Kitchen sink composite glitch pipeline.
   * Stochastically selects and executes 2 to 5 distinct glitch algorithms
   * from anywhere except presets, mutilating the original image without overriding it.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number|'auto'} [options.iterations] - Number of glitch algorithms to apply (2–5)
   * @returns {ImageData} Mutated image data
   */
  gleech.theWorks = function theWorks(imageData, options) {
    var presetNames = (gleech.categories && gleech.categories.presets)
      ? gleech.categories.presets
      : ['theWorks', 'randomGlitch', 'glitch', 'preset1', 'preset2', 'preset3', 'preset4'];

    var candidates = gleech.all.filter(function(name) {
      return !presetNames.includes(name) &&
        name !== 'sort' &&
        name !== 'XYtemplate' &&
        name !== 'RowTemplate' &&
        typeof gleech[name] === 'function';
    });

    var requested = getOpt(options, 'iterations', null, null);
    if (requested === null || requested === 'auto' || isNaN(requested)) {
      requested = getOpt(options, 'count', null, null);
    }
    var count = (typeof requested === 'number' && !isNaN(requested))
      ? Math.max(2, Math.min(5, Math.round(requested)))
      : (Math.floor(Math.random() * 4) + 2); // 2, 3, 4, or 5

    // Fisher-Yates shuffle candidate pool to pick distinct glitches
    var pool = candidates.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    var selected = pool.slice(0, count);
    for (var k = 0; k < selected.length; k++) {
      var fn = gleech[selected[k]];
      if (typeof fn === 'function') {
        imageData = fn(imageData);
      }
    }

    gleech.theWorks.lastSelected = selected;
    return imageData;
  };

  /**
   * Stochastic algorithm sequence applicator.
   * Selects 2 to 4 random glitch algorithms from non-presets and executes them in sequence.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Configuration options
   * @param {number|'auto'} [options.amount] - Number of glitches to apply (2–4)
   * @returns {ImageData} Mutated image data
   */
  gleech.randomGlitch = function randomGlitch(imageData, options) {
    var presetNames = (gleech.categories && gleech.categories.presets)
      ? gleech.categories.presets
      : ['theWorks', 'randomGlitch', 'glitch', 'preset1', 'preset2', 'preset3', 'preset4'];

    var candidates = gleech.all.filter(function(name) {
      return !presetNames.includes(name) &&
        name !== 'sort' &&
        name !== 'XYtemplate' &&
        name !== 'RowTemplate' &&
        typeof gleech[name] === 'function';
    });

    var requested = getOpt(options, 'amount', null, null);
    var count = (typeof requested === 'number' && !isNaN(requested))
      ? Math.max(2, Math.min(4, Math.round(requested)))
      : (Math.floor(Math.random() * 3) + 2); // 2, 3, or 4

    var pool = candidates.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }

    var selected = pool.slice(0, count);
    for (var k = 0; k < selected.length; k++) {
      var fn = gleech[selected[k]];
      if (typeof fn === 'function') {
        imageData = fn(imageData);
      }
    }

    gleech.randomGlitch.lastSelected = selected;
    return imageData;
  };

  /****************************************************************************
   * COMPRESSION & BROADCAST FORENSIC ARTIFACTS
   ****************************************************************************/

  /**
   * JPEG 8x8 MCU block rotation and DC coefficient drift.
   * Simulates discrete cosine transform macroblock corruption.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Options
   * @returns {ImageData} Mutated image data
   */
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
                data[idx]     = Math.min(255, Math.max(0, data[idx] + 40));
                data[idx + 1] = Math.min(255, Math.max(0, data[idx + 1] - 30));
                data[idx + 2] = Math.min(255, Math.max(0, data[idx + 2] + 40));
              } else {
                var r = dcR + rotDrift + Math.round((data[idx] - dcR) / qStep) * qStep;
                var g = dcG + rotDrift + Math.round((data[idx + 1] - dcG) / qStep) * qStep;
                var b = dcB + rotDrift + Math.round((data[idx + 2] - dcB) / qStep) * qStep;
                data[idx]     = Math.min(255, Math.max(0, r));
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

  /**
   * Gibbs phenomenon edge ringing (mosquito noise).
   * Injects high-frequency ripples near high-contrast step edges.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Options
   * @returns {ImageData} Mutated image data
   */
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
              data[tidx]     = Math.min(255, Math.max(0, data[tidx] + wave));
              data[tidx + 1] = Math.min(255, Math.max(0, data[tidx + 1] + wave * 0.8));
              data[tidx + 2] = Math.min(255, Math.max(0, data[tidx + 2] - wave));
            }
            if (y + r < height) {
              var tidx2 = ((y + r) * width + x) * 4;
              data[tidx2]     = Math.min(255, Math.max(0, data[tidx2] - wave * 0.7));
              data[tidx2 + 1] = Math.min(255, Math.max(0, data[tidx2 + 1] + wave));
              data[tidx2 + 2] = Math.min(255, Math.max(0, data[tidx2 + 2] + wave * 0.9));
            }
          }
        }
      }
    }
    return imageData;
  };

  /**
   * YCbCr 4:2:0 chroma subsampling and phase bleed.
   * Halves horizontal and vertical chrominance resolution while retaining luminance.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @param {Object} [options] - Options
   * @returns {ImageData} Mutated image data
   */
  gleech.chromaBleed420 = function chromaBleed420(imageData, options) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      total = width * height,
      Y = new Float32Array(total),
      Cb = new Float32Array(total),
      Cr = new Float32Array(total);

    // Step 1: Forward RGB -> YCbCr transform
    for (var i = 0, p = 0; i < total; i++, p += 4) {
      var r = data[p], g = data[p + 1], b = data[p + 2];
      Y[i]  =  0.299    * r + 0.587    * g + 0.114    * b;
      Cb[i] = -0.168736 * r - 0.331264 * g + 0.5      * b + 128;
      Cr[i] =  0.5      * r - 0.418688 * g - 0.081312 * b + 128;
    }

    var smearOffset = Math.round(getOpt(options, 'bleed', function() { return randRange(8, 26); }));
    var mbSize = 16;

    // Step 2: Quantize and smear chroma across 16x16 macroblocks
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

    // Step 3: Inverse YCbCr -> RGB transform
    for (var i = 0, p = 0; i < total; i++, p += 4) {
      var yVal = Y[i];
      var cbVal = Cb[i] - 128;
      var crVal = Cr[i] - 128;
      data[p]     = Math.min(255, Math.max(0, yVal + 1.402    * crVal));
      data[p + 1] = Math.min(255, Math.max(0, yVal - 0.344136 * cbVal - 0.714136 * crVal));
      data[p + 2] = Math.min(255, Math.max(0, yVal + 1.772    * cbVal));
    }
    return imageData;
  };

  /**
   * Huffman entropy bitstream desynchronization.
   * Simulates bit slips causing horizontal shearing and color displacement.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
              data[dstIdx]     = copy[srcIdx + 1];
              data[dstIdx + 1] = copy[srcIdx + 2];
              data[dstIdx + 2] = copy[srcIdx];
            } else {
              data[dstIdx]     = copy[srcIdx + 2];
              data[dstIdx + 1] = copy[srcIdx];
              data[dstIdx + 2] = copy[srcIdx + 1];
            }
          }
        }
      }
    }
    return imageData;
  };

  /**
   * Anti-JPEG Nyquist limit checkerboard poison.
   * Injects alternating 1-pixel high-frequency noise that disrupts DCT compression.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
  gleech.nyquistPoison = function nyquistPoison(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      amp = randRange(20, 42);

    for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
        var idx = (y * width + x) * 4;
        var sign = ((x + y) % 2 === 0) ? 1 : -1;
        var r = data[idx]     + sign * amp;
        var g = data[idx + 1] - sign * amp;
        var b = data[idx + 2] + sign * amp;
        data[idx]     = Math.min(255, Math.max(0, r));
        data[idx + 1] = Math.min(255, Math.max(0, g));
        data[idx + 2] = Math.min(255, Math.max(0, b));
      }
    }
    return imageData;
  };

  /**
   * JPEG restart marker (RST) dropout simulation.
   * Drops synchronization markers causing scanline collapse.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
  gleech.restartMarkerDrop = function restartMarkerDrop(imageData) {
    var width = imageData.width,
      height = imageData.height,
      data = imageData.data,
      copy = new Uint8ClampedArray(data),
      bandH = randRange(12, 24);

    var targetBand = randFloor(Math.max(1, Math.floor(height / bandH)));
    var bandIdx = 0;
    for (var y = 0; y < height; y += bandH, bandIdx++) {
      if (bandIdx === targetBand || Math.random() < 0.5) {
        var shiftMag = randRange(4, Math.max(5, Math.floor(width / 4)));
        var shift = shiftMag * (coinToss() ? 1 : -1);
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

            data[dstIdx]     = r;
            data[dstIdx + 1] = g;
            data[dstIdx + 2] = b;
          }
        }
      }
    }
    return imageData;
  };

  /**
   * Hostile DCT quantization matrix crush.
   * Re-quantizes color channels into coarse steps simulating extreme compression.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
            var hfR = (copy[idx]     - dcR) * 2.6;
            var hfG = (copy[idx + 1] - dcG) * 2.6;
            var hfB = (copy[idx + 2] - dcB) * 2.6;

            data[idx]     = Math.min(255, Math.max(0, dcR + hfR));
            data[idx + 1] = Math.min(255, Math.max(0, dcG + hfG));
            data[idx + 2] = Math.min(255, Math.max(0, dcB + hfB));
          }
        }
      }
    }
    return imageData;
  };

  /**
   * Chrominance subsampling shear.
   * Horizontally shears color components independently of luminance.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
            var rDiff  = data[srcIdx]     - (0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2]);
            var bDiff  = data[srcIdx + 2] - (0.299 * data[srcIdx] + 0.587 * data[srcIdx + 1] + 0.114 * data[srcIdx + 2]);

            data[tgtIdx]     = Math.min(255, Math.max(0, lumTgt + rDiff));
            data[tgtIdx + 2] = Math.min(255, Math.max(0, lumTgt + bDiff));
          }
        }
      }
    }
    return imageData;
  };

  /**
   * Macroblock cache ghost leak.
   * Replaces random macroblocks with displaced ghost copies from earlier buffer positions.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
            data[dIdx]     = data[dIdx]     ^ copy[sIdx];
            data[dIdx + 1] = data[dIdx + 1] ^ copy[sIdx + 1];
            data[dIdx + 2] = data[dIdx + 2] ^ copy[sIdx + 2];
          } else if (blendMode === 'inv') {
            data[dIdx]     = 255 - copy[sIdx];
            data[dIdx + 1] = 255 - copy[sIdx + 1];
            data[dIdx + 2] = 255 - copy[sIdx + 2];
          } else {
            data[dIdx]     = copy[sIdx + 1];
            data[dIdx + 1] = copy[sIdx + 2];
            data[dIdx + 2] = copy[sIdx];
          }
        }
      }
    }
    return imageData;
  };

  /**
   * VCR tape head-switching noise and tracking error.
   * Injects head-switching hash and horizontal skewing at frame margins.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
          data[dstIdx]     = noiseVal;
          data[dstIdx + 1] = noiseVal;
          data[dstIdx + 2] = noiseVal;
        } else {
          var srcX = (x + skew) % width;
          var srcIdx = (y * width + srcX) * 4;
          data[dstIdx]     = copy[srcIdx];
          data[dstIdx + 1] = Math.min(255, copy[srcIdx + 1] + 25);
          data[dstIdx + 2] = Math.max(0, copy[srcIdx + 2] - 25);
        }
      }
    }
    return imageData;
  };

  /**
   * Vertical hold sync slip.
   * Renders the vertical blanking bar and simulates teletext data pulse noise.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
        data[dIdx]     = copy[sIdx];
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
          data[idx] = 8; data[idx + 1] = 8; data[idx + 2] = 8;
        } else if (isTeletext && (Math.floor(x / 8) % 2 === 0)) {
          data[idx] = 230; data[idx + 1] = 230; data[idx + 2] = 230;
        } else {
          data[idx] = 22; data[idx + 1] = 26; data[idx + 2] = 22;
        }
      }
    }
    return imageData;
  };

  /**
   * Multipath RF antenna ghost echoes.
   * Adds displaced, attenuated ghost copies of video lines simulating broadcast reflections.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
            data[dIdx]     = Math.min(255, data[dIdx]     + copy[sIdx]     * attenuation);
            data[dIdx + 1] = Math.min(255, data[dIdx + 1] + copy[sIdx + 1] * attenuation * 0.95);
            data[dIdx + 2] = Math.min(255, data[dIdx + 2] + copy[sIdx + 2] * attenuation * 1.1);
          }
        }
      }
    }
    return imageData;
  };

  /**
   * Interlaced field misregistration (comb artifacts).
   * Displaces alternating scanline fields horizontally.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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

        data[dIdx]     = copy[sIdx];
        data[dIdx + 1] = copy[sIdx + 1];
        data[dIdx + 2] = copy[sIdx + 2];
      }
    }
    return imageData;
  };

  /**
   * MPEG transport stream packet loss.
   * Simulates broadcast packet drops with frozen rectangular macroblocks and dropouts.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
              data[idx]     = 16;
              data[idx + 1] = 235;
              data[idx + 2] = 32;
            } else if (fallbackColor === 'magenta') {
              data[idx]     = 215;
              data[idx + 1] = 25;
              data[idx + 2] = 210;
            } else {
              var stripe = (py % 4 < 2) ? 240 : 15;
              data[idx]     = stripe;
              data[idx + 1] = 255 - stripe;
              data[idx + 2] = stripe;
            }
          }
        }
      }
    }
    return imageData;
  };

  /**
   * P-frame macroblock freeze (datamoshing).
   * Freezes selected macroblock regions to simulate lost I-frame reference updates.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
            data[dIdx]     = copy[sIdx];
            data[dIdx + 1] = copy[sIdx + 1];
            data[dIdx + 2] = copy[sIdx + 2];
          }
        }
      }
    }
    return imageData;
  };

  /**
   * Digital tuner mosaic posterization and bit flips.
   * Corrupts discrete bit planes producing colorful digital noise tiles.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
            data[idx]     = data[idx]     ^ 0x60;
            data[idx + 1] = data[idx + 1] ^ 0x30;
            data[idx + 2] = data[idx + 2] ^ 0x50;
          } else if (artifactType === 'mosaic') {
            data[idx]     = avgR;
            data[idx + 1] = avgG;
            data[idx + 2] = avgB;
          } else {
            var temp = data[idx];
            data[idx]     = data[idx + 1];
            data[idx + 1] = data[idx + 2];
            data[idx + 2] = temp;
          }
        }
      }
    }
    return imageData;
  };

  /**
   * Interactive composite glitch filter.
   * Combines slicing, channel shifts, and sorting in a stochastic sequence.
   *
   * @param {ImageData} imageData - Target canvas image data
   * @returns {ImageData} Mutated image data
   */
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
