const PNG_SIGNATURE = '89504e470d0a1a0a';

const detectPngDimensions = (buffer) => {
  if (buffer.length < 24 || buffer.subarray(0, 8).toString('hex') !== PNG_SIGNATURE) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
};

const detectJpegDimensions = (buffer) => {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;
  const sofMarkers = new Set([
    0xc0,
    0xc1,
    0xc2,
    0xc3,
    0xc5,
    0xc6,
    0xc7,
    0xc9,
    0xca,
    0xcb,
    0xcd,
    0xce,
    0xcf,
  ]);

  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];

    if (marker === 0xd9 || marker === 0xda) {
      break;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (sofMarkers.has(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + segmentLength;
  }

  return null;
};

const detectWebpDimensions = (buffer) => {
  if (
    buffer.length < 30 ||
    buffer.subarray(0, 4).toString('ascii') !== 'RIFF' ||
    buffer.subarray(8, 12).toString('ascii') !== 'WEBP'
  ) {
    return null;
  }

  const chunkHeader = buffer.subarray(12, 16).toString('ascii');

  if (chunkHeader === 'VP8X') {
    return {
      width: 1 + buffer.readUIntLE(24, 3),
      height: 1 + buffer.readUIntLE(27, 3),
    };
  }

  if (chunkHeader === 'VP8 ') {
    return {
      width: buffer.readUInt16LE(26) & 0x3fff,
      height: buffer.readUInt16LE(28) & 0x3fff,
    };
  }

  if (chunkHeader === 'VP8L') {
    const width = 1 + (((buffer[22] & 0x3f) << 8) | buffer[21]);
    const height =
      1 +
      (((buffer[24] & 0x0f) << 10) | (buffer[23] << 2) | ((buffer[22] & 0xc0) >> 6));

    return { width, height };
  }

  return null;
};

export const detectImageDimensions = (imageFile) => {
  const buffer = imageFile?.buffer || imageFile;

  if (!Buffer.isBuffer(buffer)) {
    throw new Error('Could not read the uploaded image for internal face alignment.');
  }

  const dimensions =
    detectPngDimensions(buffer) ||
    detectJpegDimensions(buffer) ||
    detectWebpDimensions(buffer);

  if (!dimensions?.width || !dimensions?.height) {
    throw new Error(
      'Internal face alignment could not read the image dimensions from the target image.',
    );
  }

  return dimensions;
};
