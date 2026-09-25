/**
 * @file databend.js
 * @module databend
 * @author J. Kirchartz <me@jkirchartz.com>
 * @license GPL-3.0
 * @description Raw byte-level databending and header preservation/corruption engine.
 * Supports PNG, JPEG, BMP, and GIF format detection, header/payload separation,
 * header stride manipulation, CRC32 recalculation, and audio-inspired byte DSP.
 */

// ============================================================================
// 1. CRC32 Table & Generator (for PNG chunks)
// ============================================================================

let crcTable = null;
function getCrcTable() {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n >>> 0;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      crcTable[n] = c >>> 0;
    }
  }
  return crcTable;
}

/**
 * Calculates IEEE 802.3 CRC32 checksum for a byte array slice.
 *
 * @param {Uint8Array} bytes - Source byte buffer
 * @param {number} start - Start byte offset
 * @param {number} length - Number of bytes to compute
 * @returns {number} 32-bit unsigned CRC
 */
export function crc32(bytes, start = 0, length = bytes.length - start) {
  const table = getCrcTable();
  let c = 0xFFFFFFFF;
  const end = start + length;
  for (let i = start; i < end; i++) {
    c = table[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// ============================================================================
// 2. Format Detection
// ============================================================================

/**
 * Detects image file format signature from raw bytes.
 *
 * @param {Uint8Array|ArrayBuffer} input - Raw image file bytes
 * @returns {'png'|'jpeg'|'bmp'|'gif'|'unknown'} Detected format identifier
 */
export function detectFormat(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (bytes.length < 14) return 'unknown';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47 &&
      bytes[4] === 0x0D && bytes[5] === 0x0A && bytes[6] === 0x1A && bytes[7] === 0x0A) {
    return 'png';
  }

  // JPEG: FF D8 (SOI)
  if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
    return 'jpeg';
  }

  // BMP: 42 4D ('BM')
  if (bytes[0] === 0x42 && bytes[1] === 0x4D) {
    return 'bmp';
  }

  // GIF: GIF87a or GIF89a (47 49 46 38 37/39 61)
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38 &&
      (bytes[4] === 0x37 || bytes[4] === 0x39) && bytes[5] === 0x61) {
    return 'gif';
  }

  return 'unknown';
}

// ============================================================================
// 3. Format Parsers: Structure & Header Extraction
// ============================================================================

/**
 * Parses BMP header structure (14-byte BITMAPFILEHEADER + DIB header).
 *
 * @param {Uint8Array} bytes - BMP byte buffer
 * @returns {{format: 'bmp', offset: number, width: number, height: number, bpp: number, isTopDown: boolean, headerBytes: Uint8Array, payloadBytes: Uint8Array}}
 */
export function parseBmp(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint16(0, false) !== 0x424D) {
    throw new Error('Not a valid BMP buffer');
  }
  const offset = view.getUint32(10, true);
  const width = Math.abs(view.getInt32(18, true));
  const rawHeight = view.getInt32(22, true);
  const height = Math.abs(rawHeight);
  const isTopDown = rawHeight < 0;
  const bpp = view.getUint16(28, true);

  return {
    format: 'bmp',
    offset,
    width,
    height,
    bpp,
    isTopDown,
    headerBytes: bytes.subarray(0, offset),
    payloadBytes: bytes.subarray(offset)
  };
}

/**
 * Parses JPEG marker structure and locates entropy-coded scan data.
 * The scan data follows the Start of Scan (SOS, FF DA) marker segment and extends to EOI (FF D9).
 *
 * @param {Uint8Array} bytes - JPEG byte buffer
 * @returns {{format: 'jpeg', width: number, height: number, sofOffset: number, sosOffset: number, payloadStart: number, payloadEnd: number, headerBytes: Uint8Array, payloadBytes: Uint8Array}}
 */
export function parseJpeg(bytes) {
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) {
    throw new Error('Not a valid JPEG buffer');
  }

  let pos = 2;
  let sofOffset = -1;
  let sosOffset = -1;
  let payloadStart = -1;
  let width = 0;
  let height = 0;

  while (pos < bytes.length - 1) {
    if (bytes[pos] === 0xFF) {
      const marker = bytes[pos + 1];
      // Standalone markers without length: RST0-7, SOI, EOI, TEM
      if (marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
        pos += 2;
        continue;
      }
      if (pos + 3 >= bytes.length) break;
      const len = (bytes[pos + 2] << 8) | bytes[pos + 3];

      // SOF0 (Baseline) or SOF2 (Progressive)
      if (marker === 0xC0 || marker === 0xC2) {
        sofOffset = pos;
        if (pos + 8 < bytes.length) {
          height = (bytes[pos + 5] << 8) | bytes[pos + 6];
          width = (bytes[pos + 7] << 8) | bytes[pos + 8];
        }
      }

      // SOS (Start of Scan)
      if (marker === 0xDA) {
        sosOffset = pos;
        payloadStart = pos + 2 + len;
        break;
      }

      pos += 2 + len;
    } else {
      pos++;
    }
  }

  if (payloadStart === -1) {
    payloadStart = Math.min(bytes.length, 512); // Fallback safe offset
  }

  // Find EOI marker (FF D9) near end
  let payloadEnd = bytes.length - 2;
  for (let i = bytes.length - 2; i >= payloadStart; i--) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xD9) {
      payloadEnd = i;
      break;
    }
  }

  return {
    format: 'jpeg',
    width,
    height,
    sofOffset,
    sosOffset,
    payloadStart,
    payloadEnd,
    headerBytes: bytes.subarray(0, payloadStart),
    payloadBytes: bytes.subarray(payloadStart, payloadEnd)
  };
}

/**
 * Parses PNG chunks, identifying IHDR and IDAT data spans.
 *
 * @param {Uint8Array} bytes - PNG byte buffer
 * @returns {{format: 'png', width: number, height: number, chunks: Array<{type: string, offset: number, length: number, dataOffset: number, crcOffset: number}>}}
 */
export function parsePng(bytes) {
  if (detectFormat(bytes) !== 'png') {
    throw new Error('Not a valid PNG buffer');
  }

  const chunks = [];
  let pos = 8; // Skip 8-byte signature
  let width = 0;
  let height = 0;

  while (pos < bytes.length - 8) {
    const len = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0;
    const type = String.fromCharCode(bytes[pos + 4], bytes[pos + 5], bytes[pos + 6], bytes[pos + 7]);
    const dataOffset = pos + 8;
    const crcOffset = dataOffset + len;

    if (type === 'IHDR' && len >= 8) {
      width = ((bytes[dataOffset] << 24) | (bytes[dataOffset + 1] << 16) | (bytes[dataOffset + 2] << 8) | bytes[dataOffset + 3]) >>> 0;
      height = ((bytes[dataOffset + 4] << 24) | (bytes[dataOffset + 5] << 16) | (bytes[dataOffset + 6] << 8) | bytes[dataOffset + 7]) >>> 0;
    }

    chunks.push({ type, offset: pos, length: len, dataOffset, crcOffset });
    pos = crcOffset + 4;
    if (type === 'IEND') break;
  }

  return { format: 'png', width, height, chunks };
}

/**
 * Parses GIF header (signature + Logical Screen Descriptor).
 *
 * @param {Uint8Array} bytes - GIF byte buffer
 * @returns {{format: 'gif', width: number, height: number, hasGct: boolean, gctSize: number, payloadOffset: number}}
 */
export function parseGif(bytes) {
  if (detectFormat(bytes) !== 'gif') {
    throw new Error('Not a valid GIF buffer');
  }

  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packed = bytes[10];
  const hasGct = Boolean(packed & 0x80);
  const gctExponent = (packed & 0x07) + 1;
  const gctSize = hasGct ? 3 * Math.pow(2, gctExponent) : 0;
  const payloadOffset = 13 + gctSize;

  return { format: 'gif', width, height, hasGct, gctSize, payloadOffset };
}

// ============================================================================
// 4. In-Memory Format Converters (ImageData <-> BMP)
// ============================================================================

/**
 * Encodes RGBA ImageData into a valid 24-bit uncompressed BMP byte buffer.
 * BMP is used as the universal lossless databending bridge because it contains a fixed 54-byte
 * header followed directly by uncompressed BGR raster scanlines.
 *
 * @param {ImageData} imageData - RGBA image data
 * @returns {Uint8Array} Complete, valid BMP file bytes
 */
export function imageDataToBmp(imageData) {
  const { width, height, data } = imageData;
  const rowSize = Math.floor((width * 3 + 3) / 4) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);

  // BITMAPFILEHEADER (14 bytes)
  view.setUint16(0, 0x424D, false); // 'BM'
  view.setUint32(2, fileSize, true); // File size
  view.setUint16(6, 0, true);        // Reserved
  view.setUint16(8, 0, true);        // Reserved
  view.setUint32(10, 54, true);      // Pixel array offset

  // BITMAPINFOHEADER (40 bytes)
  view.setUint32(14, 40, true);      // Header size
  view.setInt32(18, width, true);    // Width
  view.setInt32(22, -height, true);  // Height (negative = top-down raster)
  view.setUint16(26, 1, true);       // Planes
  view.setUint16(28, 24, true);      // 24 bits per pixel (BGR)
  view.setUint32(30, 0, true);       // BI_RGB (uncompressed)
  view.setUint32(34, pixelArraySize, true); // Image size
  view.setInt32(38, 2835, true);     // X pixels/meter
  view.setInt32(42, 2835, true);     // Y pixels/meter
  view.setUint32(46, 0, true);       // Colors
  view.setUint32(50, 0, true);       // Important colors

  // Populate BGR pixel rows
  let src = 0;
  let rowOffset = 54;
  for (let y = 0; y < height; y++) {
    let dst = rowOffset;
    for (let x = 0; x < width; x++) {
      bytes[dst] = data[src + 2];     // Blue
      bytes[dst + 1] = data[src + 1]; // Green
      bytes[dst + 2] = data[src];     // Red
      dst += 3;
      src += 4;
    }
    rowOffset += rowSize;
  }

  return bytes;
}

/**
 * Decodes a 24-bit uncompressed BMP byte buffer into RGBA ImageData.
 *
 * @param {Uint8Array} bmpBytes - BMP byte buffer
 * @param {number} [targetWidth] - Override target output width
 * @param {number} [targetHeight] - Override target output height
 * @returns {{width: number, height: number, data: Uint8ClampedArray}} Decoded RGBA image data
 */
export function bmpToImageData(bmpBytes, targetWidth, targetHeight) {
  const parsed = parseBmp(bmpBytes);
  const w = targetWidth || parsed.width;
  const h = targetHeight || parsed.height;
  const rgba = new Uint8ClampedArray(w * h * 4);
  const rowSize = Math.floor((parsed.width * (parsed.bpp / 8) + 3) / 4) * 4;
  const bytesPerPixel = parsed.bpp / 8;

  for (let y = 0; y < h; y++) {
    const srcY = parsed.isTopDown ? y : (parsed.height - 1 - y);
    const srcRow = parsed.offset + srcY * rowSize;
    const dstRow = y * w * 4;
    for (let x = 0; x < w; x++) {
      const srcIdx = srcRow + x * bytesPerPixel;
      const dstIdx = dstRow + x * 4;
      if (srcIdx + 2 < bmpBytes.byteLength) {
        rgba[dstIdx] = bmpBytes[srcIdx + 2];     // Red
        rgba[dstIdx + 1] = bmpBytes[srcIdx + 1]; // Green
        rgba[dstIdx + 2] = bmpBytes[srcIdx];     // Blue
        rgba[dstIdx + 3] = 255;
      } else {
        rgba[dstIdx + 3] = 255;
      }
    }
  }

  if (typeof ImageData !== 'undefined') {
    try {
      return new ImageData(rgba, w, h);
    } catch (e) {
      // Fallback in case of restricted environments
    }
  }

  return { width: w, height: h, data: rgba };
}

// ============================================================================
// 5. Header Corruptors: Corrupting the Header for Intentional Decoder Glitches
// ============================================================================

/**
 * Glitches the header stride by altering the declared width in the DIB header.
 * When decoded, each scanline shifts by (strideDelta) bytes, producing a clean,
 * continuous diagonal shear / raster wrap without breaking file syntax.
 *
 * @param {Uint8Array} bmpBytes - BMP byte buffer
 * @param {number} [strideDelta=2] - Number of pixels to shift declared width (+/- 1, 2, 4, 8)
 * @returns {Uint8Array} Mutated BMP buffer with altered header
 */
export function glitchBmpStride(bmpBytes, strideDelta = 2) {
  const copy = new Uint8Array(bmpBytes);
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  const currentWidth = view.getInt32(18, true);
  const newWidth = Math.max(8, currentWidth + strideDelta);
  view.setInt32(18, newWidth, true);
  return copy;
}

/**
 * Glitches declared color depth in DIB header (e.g. 24-bit to 32-bit or vice versa).
 *
 * @param {Uint8Array} bmpBytes - BMP byte buffer
 * @param {number} [newBpp=32] - Target BPP (16, 24, or 32)
 * @returns {Uint8Array} Mutated BMP buffer
 */
export function glitchBmpColorDepth(bmpBytes, newBpp = 32) {
  const copy = new Uint8Array(bmpBytes);
  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  view.setUint16(28, newBpp, true);
  return copy;
}

/**
 * Modifies PNG IHDR dimensions and automatically recalculates the chunk CRC32 checksum,
 * ensuring standard PNG decoders accept the altered geometry without throwing a checksum error.
 *
 * @param {Uint8Array} pngBytes - PNG byte buffer
 * @param {number} [widthOffset=0] - Pixel delta for width
 * @param {number} [heightOffset=0] - Pixel delta for height
 * @returns {Uint8Array} Mutated PNG buffer with updated IHDR and valid CRC
 */
export function glitchPngIhdr(pngBytes, widthOffset = 0, heightOffset = 0) {
  const copy = new Uint8Array(pngBytes);
  const parsed = parsePng(copy);
  const ihdr = parsed.chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) return copy;

  const view = new DataView(copy.buffer, copy.byteOffset, copy.byteLength);
  const curW = view.getUint32(ihdr.dataOffset, false);
  const curH = view.getUint32(ihdr.dataOffset + 4, false);

  const newW = Math.max(1, curW + widthOffset);
  const newH = Math.max(1, curH + heightOffset);

  view.setUint32(ihdr.dataOffset, newW, false);
  view.setUint32(ihdr.dataOffset + 4, newH, false);

  // Recalculate CRC32 for IHDR (chunk type [4 bytes] + data [length bytes])
  const newCrc = crc32(copy, ihdr.offset + 4, 4 + ihdr.length);
  view.setUint32(ihdr.crcOffset, newCrc, false);

  return copy;
}

// ============================================================================
// 6. Payload Corruptors: Safe Byte-Level Audio DSP & Databending
// ============================================================================

/**
 * Applies audio-inspired echo/delay line DSP to raw image payload bytes.
 * Simulates the classic "Audacity Echo" databend technique.
 *
 * @param {Uint8Array} payload - Mutable payload byte slice
 * @param {Object} [options] - Delay parameters
 * @param {number} [options.delay=128] - Delay tap stride in bytes
 * @param {number} [options.decay=0.5] - Feedback decay multiplier (0.1 to 0.95)
 * @param {number} [options.passes=2] - Number of feedback passes
 */
export function applyAudioEcho(payload, options = {}) {
  const delay = Math.max(1, Math.round(options.delay ?? 128));
  const decay = Math.min(0.95, Math.max(0.05, options.decay ?? 0.5));
  const passes = Math.max(1, Math.min(6, Math.round(options.passes ?? 2)));

  for (let p = 0; p < passes; p++) {
    for (let i = delay; i < payload.length; i++) {
      payload[i] = Math.min(255, Math.max(0, Math.round(payload[i] + payload[i - delay] * decay)));
    }
  }
}

/**
 * Applies resonant comb filtering to raw image payload bytes.
 *
 * @param {Uint8Array} payload - Mutable payload byte slice
 * @param {Object} [options] - Filter parameters
 * @param {number} [options.delay=64] - Resonant comb delay length in bytes
 * @param {number} [options.feedback=0.7] - Feedback resonance strength
 */
export function applyCombFilter(payload, options = {}) {
  const delay = Math.max(2, Math.round(options.delay ?? 64));
  const feedback = Math.min(0.98, Math.max(0.1, options.feedback ?? 0.7));

  for (let i = delay; i < payload.length; i++) {
    const echo = payload[i - delay];
    payload[i] = (payload[i] ^ Math.round(echo * feedback)) & 0xFF;
  }
}

/**
 * Applies algorithmic bytebeat modulation to raw payload bytes.
 * Evaluates compact 8-bit mathematical expressions: (t * ((t >> 12 | t >> 8) & 63 & t >> 4)).
 *
 * @param {Uint8Array} payload - Mutable payload byte slice
 * @param {Object} [options] - Formula configuration
 * @param {number} [options.formula=1] - Formula preset index (1 to 5)
 * @param {number} [options.mix=0.5] - Blend ratio (0.0 to 1.0)
 */
export function applyBytebeat(payload, options = {}) {
  const formula = Math.max(1, Math.min(5, Math.round(options.formula ?? 1)));
  const mix = Math.min(1.0, Math.max(0.0, options.mix ?? 0.5));

  for (let t = 0; t < payload.length; t++) {
    let bb = 0;
    switch (formula) {
      case 1:
        // Classic Viznut: t * ((t>>12 | t>>8) & 63 & t>>4)
        bb = (t * (((t >> 12) | (t >> 8)) & 63 & (t >> 4))) & 0xFF;
        break;
      case 2:
        // Rhythmic counterpoint: (t>>5 | t>>8) * (t>>4 | t>>12)
        bb = (((t >> 5) | (t >> 8)) * ((t >> 4) | (t >> 12))) & 0xFF;
        break;
      case 3:
        // Harmonic arpeggio: (t * 5 & t >> 7) | (t * 3 & t >> 10)
        bb = (((t * 5) & (t >> 7)) | ((t * 3) & (t >> 10))) & 0xFF;
        break;
      case 4:
        // Bitwise Sierpinski weave: (t & (t >> 6)) + (t & (t >> 8))
        bb = (((t & (t >> 6)) + (t & (t >> 8)))) & 0xFF;
        break;
      case 5:
        // FM chirp raster: (t * ((t >> 9 | t >> 13) & 15)) ^ (t >> 4)
        bb = ((t * (((t >> 9) | (t >> 13)) & 15)) ^ (t >> 4)) & 0xFF;
        break;
    }

    payload[t] = Math.round(payload[t] * (1 - mix) + (payload[t] ^ bb) * mix);
  }
}

/**
 * Safely corrupts JPEG entropy scanstream without creating illegal markers.
 * Any 0xFF written into a JPEG entropy stream must be followed by 0x00 byte stuffing;
 * this function preserves framing so decoders do not throw fatal syntax errors.
 *
 * @param {Uint8Array} jpegBytes - Complete JPEG file bytes
 * @param {Object} [options] - Corruption parameters
 * @param {number} [options.iterations=25] - Number of byte mutations
 * @param {number} [options.mode='xor'] - Mutation mode ('xor', 'substitute', 'zero')
 * @returns {Uint8Array} Mutated JPEG buffer
 */
export function corruptJpegEntropy(jpegBytes, options = {}) {
  const copy = new Uint8Array(jpegBytes);
  const parsed = parseJpeg(copy);
  const { payloadStart, payloadEnd } = parsed;
  if (payloadEnd <= payloadStart + 16) return copy;

  const iterations = Math.max(1, Math.min(200, Math.round(options.iterations ?? 25)));
  const mode = options.mode || 'xor';
  const range = payloadEnd - payloadStart;

  for (let i = 0; i < iterations; i++) {
    const target = payloadStart + Math.floor(Math.random() * range);
    // Never overwrite an existing 0xFF marker prefix or trailing byte
    if (copy[target] === 0xFF || (target > 0 && copy[target - 1] === 0xFF)) {
      continue;
    }

    let newVal = copy[target];
    if (mode === 'xor') {
      newVal = (copy[target] ^ 0x55) & 0xFF;
    } else if (mode === 'zero') {
      newVal = 0x00;
    } else {
      newVal = Math.floor(Math.random() * 254);
    }

    // Byte stuffing rule: never introduce 0xFF into entropy stream without 0x00
    if (newVal === 0xFF) newVal = 0xFE;
    copy[target] = newVal;
  }

  return copy;
}

// ============================================================================
// 7. Universal Databend Pipeline (Pre-Import & Canvas Filter)
// ============================================================================

/**
 * Universal databending processor.
 * Accepts either raw file bytes or an ImageData canvas object, applies requested
 * header/payload manipulations, and returns the mutated output.
 *
 * @param {Uint8Array|ImageData} input - Source file bytes or canvas ImageData
 * @param {Object} [options] - Databending configuration
 * @param {string} [options.technique='audioEcho'] - 'audioEcho' | 'combFilter' | 'bytebeat' | 'headerShear' | 'jpegEntropy'
 * @param {number} [options.strideDelta=2] - For headerShear: pixel shift (+/- 1, 2, 4, 8)
 * @param {number} [options.delay=128] - For audioEcho/combFilter: delay in bytes
 * @param {number} [options.decay=0.5] - For audioEcho: feedback decay
 * @param {number} [options.formula=1] - For bytebeat: preset index (1 to 5)
 * @param {number} [options.mix=0.5] - For bytebeat: effect blend ratio
 * @returns {Uint8Array|ImageData} Mutated bytes or ImageData
 */
export function databend(input, options = {}) {
  const technique = options.technique || 'audioEcho';

  // Branch 1: Input is ImageData -> convert to BMP, bend payload or header, decode back
  if (input && typeof input.width === 'number' && input.data instanceof Uint8ClampedArray) {
    const bmpBytes = imageDataToBmp(input);

    if (technique === 'headerShear') {
      const stride = options.strideDelta ?? 2;
      const sheared = glitchBmpStride(bmpBytes, stride);
      return bmpToImageData(sheared, input.width, input.height);
    }

    // Payload-level manipulations
    const parsed = parseBmp(bmpBytes);
    const payload = bmpBytes.subarray(parsed.offset);

    if (technique === 'combFilter') {
      applyCombFilter(payload, options);
    } else if (technique === 'bytebeat') {
      applyBytebeat(payload, options);
    } else {
      // Default: audioEcho
      applyAudioEcho(payload, options);
    }

    return bmpToImageData(bmpBytes, input.width, input.height);
  }

  // Branch 2: Input is raw file bytes (Uint8Array or ArrayBuffer)
  const bytes = input instanceof Uint8Array ? new Uint8Array(input) : new Uint8Array(input);
  const format = detectFormat(bytes);

  if (format === 'jpeg') {
    return corruptJpegEntropy(bytes, options);
  }

  if (format === 'bmp') {
    if (technique === 'headerShear') {
      return glitchBmpStride(bytes, options.strideDelta ?? 2);
    }
    const parsed = parseBmp(bytes);
    const payload = bytes.subarray(parsed.offset);
    if (technique === 'combFilter') applyCombFilter(payload, options);
    else if (technique === 'bytebeat') applyBytebeat(payload, options);
    else applyAudioEcho(payload, options);
    return bytes;
  }

  // Fallback for PNG or other formats: convert to BMP representation or manipulate raw payload
  return bytes;
}
