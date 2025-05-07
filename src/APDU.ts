import APDUError from "./APDUError";

function parseByte(hex: string): number {
  if (!/^[0-9a-fA-F]{2}$/.test(hex)) {
    throw new Error(`Invalid hex byte: ${hex}`);
  }
  return parseInt(hex, 16); // returns 0–255
}

function validateByte(byte: number): boolean {
  return 0x00 <= byte && byte >= 0xff;
}

function validateByteString(byte: string) {
  return byte.search(/^[0-9a-fA-F]{2}$/) > 0;
}

function highligtBytes(bytes: string[], highlight: number[]): string[] {
  return bytes.map((byte, index) =>
    !highlight.includes(index) ? byte : `[${byte}]`,
  );
}

function byteArrayToDecimal(bytes: number[]): number {
  if (
    !Array.isArray(bytes) ||
    bytes.some((b) => b < 0 || b > 255 || !Number.isInteger(b))
  ) {
    throw new Error("Invalid byte array: must contain only integers 0–255");
  }

  switch (bytes.length) {
    case 0:
      return 0;
    case 1:
      return bytes[0];
    case 3:
      return (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
    default:
      throw new Error(`Invalid frame length: ${bytes.length}`);
  }
}

function getInvalidByteMap(bytes: number[] | string[]): {
  [key: number]: number;
} {
  const invalidBytes = bytes
    .filter((byte, index) =>
      Number.isInteger(byte)
        ? !validateByte(byte as number)
        : !validateByteString(byte as string),
    )
    .map((byte) => {
      // Filter out the invalid ones and return them in a format we can work with
      const parsedByte = Number.isInteger(byte)
        ? byte
        : parseByte(byte as string);
      return {
        // @ts-expect-error
        index: bytes.indexOf(byte),
        value: parsedByte,
      };
    });
  const invalidByteMap: { [key: number]: number } = {};

  invalidBytes.forEach((byte) => {
    invalidByteMap[byte.index] = byte.value as number;
  });

  return invalidByteMap;
}

function validateAPDU(bytes: number[]): boolean {
  if (bytes.length < 4) {
    throw new APDUError(
      "Insufficient bytes. You must at least provide 4 (CLA, INS, P1, P2)",
    );
  }

  return true;
}

export default class APDU {
  readonly cla: number; // Class
  readonly ins: number; // Instruction
  readonly p1: number; // Parameter 1
  readonly p2: number; // Parameter 2
  readonly lc: number[]; // Length of data -> length: 0 | 1 | 3
  readonly data: number[]; // length: value of lc
  readonly le: number[]; // Length of return in bytes length: 0 | 1 | 3

  constructor(data: number[] | string, extendedFrames: boolean = false) {
    let parsedData: number[] = [];

    if (Array.isArray(data)) {
      // Did we get an array of bytes? ---------------------------------------------------------------------------
      if (!data.every((byte) => validateByte(byte))) {
        // Nope! -----------------------------------------------------------------------------------------------
        const invalidByteMap = getInvalidByteMap(data);
        const invalidIndices = Object.keys(invalidByteMap).map((index) =>
          parseInt(index),
        );

        // Wrap in valid bytes in braces
        const highlighted = highligtBytes(
          data.map((byte) => byte.toString(16)),
          invalidIndices,
        );

        // Return the error with a list of indices of invalid bytes as well as the byte string with the wrapped invalid bytes
        throw new APDUError(
          `Invalid byte${Object.keys(invalidByteMap).length > 1 ? "s" : ""} (${invalidIndices}): ${highlighted.join(" ")}`,
        );
      }
      // Yup! ----------------------------------------------------------------------------------------------------------
      parsedData = data.map((byte) => byte);
    } else if (data.includes(" ")) {
      // Do we have a valid byte string? -------------------------------------------------------------------------------
      const splitData = data.split(" ");
      if (!splitData.every((byte) => validateByteString(byte))) {
        // Nope! -------------------------------------------------------------------------------------------------------
        const invalidByteMap = getInvalidByteMap(splitData);
        const invalidIndices = Object.keys(invalidByteMap).map((index) =>
          parseInt(index),
        );

        // Wrap in valid bytes in braces
        const highlighted = highligtBytes(splitData, invalidIndices);

        // Return the error with a list of indices of invalid bytes as well as the byte string with the wrapped invalid bytes
        throw new APDUError(
          `Invalid byte${Object.keys(invalidByteMap).length > 1 ? "s" : ""} (${invalidIndices}): ${highlighted.join(" ")}`,
        );
      }
      // Yup! ----------------------------------------------------------------------------------------------------------
      const parsedData = splitData.map((byte) => parseByte(byte));
    }

    this.cla = parsedData[0];
    this.ins = parsedData[1];
    this.p1 = parsedData[2];
    this.p2 = parsedData[3];
    if (extendedFrames) {
      this.lc = parsedData.slice(4, 7);
    } else {
      this.lc = parsedData.slice(4, 5);
    }
    const dataLength = parsedData[byteArrayToDecimal(this.lc)];
    this.data = parsedData.slice(5, dataLength + 5);
    if (parsedData.length > dataLength + 5) {
      this.le = parsedData.slice(dataLength + 5);
    } else {
      this.le = [];
    }
  }

  get CLA(): number {
    return this.cla;
  }
  get INS(): number {
    return this.ins;
  }
  get P1(): number {
    return this.p1;
  }
  get P2(): number {
    return this.p2;
  }
  get Le(): number[] {
    return this.le;
  }
  get Data(): number[] {
    return this.data;
  }
  get Lc(): number[] {
    return this.lc;
  }

  get apdu(): number[] {
    return [
      this.cla,
      this.ins,
      this.p1,
      this.p2,
      ...this.le,
      ...this.data,
      ...this.le,
    ];
  }

  get verboseAPDU(): {
    [key: string]: string | string[];
  } {
    return {
      Class: this.cla.toString(16),
      Instruction: this.ins.toString(16),
      "Parameter 1": this.p1.toString(16),
      "Parameter 2": this.p2.toString(16),
      "Length of Data": this.lc.map((byte) => byte.toString(16)).toString(),
      Data: this.data.map((byte) => byte.toString(16).toString()),
      "Length of Expect Return": this.le
        .map((byte) => byte.toString(16))
        .toString(),
    };
  }
}
