function buildGaloisTables() {
  const exp = new Array<number>(512).fill(0);
  const log = new Array<number>(256).fill(0);
  let value = 1;
  for (let index = 0; index < 255; index += 1) {
    exp[index] = value;
    log[value] = index;
    value <<= 1;
    if (value & 0x100) value ^= 0x11d;
  }
  for (let index = 255; index < 512; index += 1) exp[index] = exp[index - 255];
  return { exp, log };
}

const GF = buildGaloisTables();

function gfMultiply(left: number, right: number) {
  if (left === 0 || right === 0) return 0;
  return GF.exp[GF.log[left] + GF.log[right]];
}

function multiplyPolynomials(left: number[], right: number[]) {
  const result = new Array<number>(left.length + right.length - 1).fill(0);
  for (let i = 0; i < left.length; i += 1) {
    for (let j = 0; j < right.length; j += 1) {
      result[i + j] ^= gfMultiply(left[i], right[j]);
    }
  }
  return result;
}

function reedSolomon(data: number[], eccLength: number) {
  let generator = [1];
  for (let index = 0; index < eccLength; index += 1) {
    generator = multiplyPolynomials(generator, [1, GF.exp[index]]);
  }

  const remainder = new Array<number>(eccLength).fill(0);
  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let index = 0; index < eccLength; index += 1) {
      remainder[index] ^= gfMultiply(generator[index + 1], factor);
    }
  }
  return remainder;
}

function appendBits(target: number[], value: number, length: number) {
  for (let bit = length - 1; bit >= 0; bit -= 1) target.push((value >>> bit) & 1);
}

function encodeVersion6L(value: string) {
  const bytes = Array.from(new TextEncoder().encode(value));
  const dataCodewords = 136;
  const blockDataCodewords = 68;
  const eccCodewordsPerBlock = 18;
  const capacityBits = dataCodewords * 8;
  const bits: number[] = [];

  // Byte mode + 8-bit byte count for QR versions 1–9.
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);
  for (const byte of bytes) appendBits(bits, byte, 8);

  if (bits.length > capacityBits) {
    throw new Error("Collector URL terlalu panjang untuk QR internal.");
  }

  for (let index = 0; index < Math.min(4, capacityBits - bits.length); index += 1) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const data: number[] = [];
  for (let offset = 0; offset < bits.length; offset += 8) {
    let byte = 0;
    for (let bit = 0; bit < 8; bit += 1) byte = (byte << 1) | bits[offset + bit];
    data.push(byte);
  }
  let pad = 0;
  while (data.length < dataCodewords) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
    pad += 1;
  }

  const blocks = [data.slice(0, blockDataCodewords), data.slice(blockDataCodewords)];
  const eccBlocks = blocks.map((block) => reedSolomon(block, eccCodewordsPerBlock));
  const interleaved: number[] = [];
  for (let index = 0; index < blockDataCodewords; index += 1) {
    for (const block of blocks) interleaved.push(block[index]);
  }
  for (let index = 0; index < eccCodewordsPerBlock; index += 1) {
    for (const block of eccBlocks) interleaved.push(block[index]);
  }
  return interleaved;
}

function bchFormatBits(data: number) {
  let value = data << 10;
  const generator = 0x537;
  const bitLength = (input: number) => {
    let length = 0;
    for (let current = input; current !== 0; current >>>= 1) length += 1;
    return length;
  };
  while (bitLength(value) - bitLength(generator) >= 0) {
    value ^= generator << (bitLength(value) - bitLength(generator));
  }
  return ((data << 10) | value) ^ 0x5412;
}

function generateQrMatrix(value: string) {
  const version = 6;
  const size = 17 + version * 4;
  const matrix = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null));

  function setFinder(row: number, col: number) {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const y = row + r;
        const x = col + c;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        const dark =
          r >= 0 && r <= 6 && c >= 0 && c <= 6 &&
          (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        matrix[y][x] = dark;
      }
    }
  }

  setFinder(0, 0);
  setFinder(size - 7, 0);
  setFinder(0, size - 7);

  for (let index = 8; index < size - 8; index += 1) {
    if (matrix[index][6] === null) matrix[index][6] = index % 2 === 0;
    if (matrix[6][index] === null) matrix[6][index] = index % 2 === 0;
  }

  const alignmentCenter = 34;
  if (matrix[alignmentCenter][alignmentCenter] === null) {
    for (let r = -2; r <= 2; r += 1) {
      for (let c = -2; c <= 2; c += 1) {
        matrix[alignmentCenter + r][alignmentCenter + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
      }
    }
  }

  // Error correction level L (01), mask 0 (000).
  const formatBits = bchFormatBits(0b01000);
  for (let index = 0; index < 15; index += 1) {
    const dark = ((formatBits >>> index) & 1) === 1;
    if (index < 6) matrix[index][8] = dark;
    else if (index < 8) matrix[index + 1][8] = dark;
    else matrix[size - 15 + index][8] = dark;

    if (index < 8) matrix[8][size - index - 1] = dark;
    else if (index < 9) matrix[8][7] = dark;
    else matrix[8][15 - index - 1] = dark;
  }
  matrix[size - 8][8] = true;

  const codewords = encodeVersion6L(value);
  let byteIndex = 0;
  let bitIndex = 7;
  let row = size - 1;
  let direction = -1;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    while (true) {
      for (let offset = 0; offset < 2; offset += 1) {
        const x = col - offset;
        if (matrix[row][x] !== null) continue;
        let dark = false;
        if (byteIndex < codewords.length) dark = ((codewords[byteIndex] >>> bitIndex) & 1) === 1;
        if ((row + x) % 2 === 0) dark = !dark;
        matrix[row][x] = dark;
        bitIndex -= 1;
        if (bitIndex < 0) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }
      row += direction;
      if (row < 0 || row >= size) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }

  return matrix as boolean[][];
}

export function QrCode({ value, size = 148 }: { value: string; size?: number }) {
  const matrix = generateQrMatrix(value);
  const quiet = 4;
  const total = matrix.length + quiet * 2;
  let path = "";
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix.length; col += 1) {
      if (matrix[row][col]) path += `M${col + quiet} ${row + quiet}h1v1h-1z`;
    }
  }

  return (
    <svg
      aria-label="QR code Collector"
      className="collector-qr"
      height={size}
      role="img"
      viewBox={`0 0 ${total} ${total}`}
      width={size}
    >
      <rect width={total} height={total} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
}
