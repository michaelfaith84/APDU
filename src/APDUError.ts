export default class APDUError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "APDUError";
  }
}

const apduStatusWords: { [key: string]: { [key: string]: string[] } } = {
  "6E": {
    "00": ["E", "Class not supported"],
    XX: ["E", "Instruction class not supported (procedure byte), (ISO 7816-3)"],
  },
  "6D": {
    "00": ["E", "Instruction code not supported or invalid"],
    XX: [
      "E",
      "Instruction code not programmed or invalid (procedure byte), (ISO 7816-3)",
    ],
  },
  "6C": {
    "00": ["E", "Incorrect P3 length."],
    XX: ["E", "Bad length value in Le; ‘xx’ is the correct exact Le"],
  },
  "6B": {
    "00": ["E", "Wrong parameter(s) P1-P2"],
    XX: ["E", "Reference incorrect (procedure byte), (ISO 7816-3)"],
  },
  "6A": {
    "00": ["E", "No information given (Bytes P1 and/or P2 are incorrect)"],
    "80": ["E", "The parameters in the data field are incorrect."],
    "81": ["E", "Function not supported"],
    "82": ["E", "File not found"],
    "83": ["E", "Record not found"],
    "84": ["E", "There is insufficient memory space in record or file"],
    "85": ["E", "Lc inconsistent with TLV structure"],
    "86": ["E", "Incorrect P1 or P2 parameter."],
    "87": ["E", "Lc inconsistent with P1-P2"],
    "88": ["E", "Referenced data not found"],
    "89": ["E", "File already exists"],
    "8A": ["E", "DF name already exists."],
    F0: ["E", "Wrong parameter value"],
    FX: ["E", "–"],
    XX: ["E", "RFU"],
  },
  "67": {
    "00": ["E", "Wrong length"],
    XX: ["E", "Length incorrect (procedure)(ISO 7816-3)"],
  },
  "68": {
    "00": [
      "E",
      "No information given (The request function is not supported by the card)",
    ],
    "81": ["E", "Logical channel not supported"],
    "82": ["E", "Secure messaging not supported"],
    "83": ["E", "Last command of the chain expected"],
    "84": ["E", "Command chaining not supported"],
    FX: ["E", "–"],
    XX: ["E", "RFU"],
  },
  "69": {
    "00": ["E", "No information given (Command not allowed)"],
    "01": ["E", "Command not accepted (inactive state)"],
    "81": ["E", "Command incompatible with file structure"],
    "82": ["E", "Security condition not satisfied."],
    "83": ["E", "Authentication method blocked"],
    "84": ["E", "Referenced data reversibly blocked (invalidated)"],
    "85": ["E", "Conditions of use not satisfied."],
    "86": ["E", "Command not allowed (no current EF)"],
    "87": ["E", "Expected secure messaging (SM) object missing"],
    "88": ["E", "Incorrect secure messaging (SM) data object"],
    "96": ["E", "Data must be updated again"],
    E1: ["E", "POL1 of the currently Enabled Profile prevents this action."],
    F0: ["E", "Permission Denied"],
    F1: ["E", "Permission Denied – Missing Privilege"],
    FX: ["E", "–"],
    XX: ["E", "RFU"],
  },
  "90": {
    "00": ["I", "Command successfully executed (OK)."],
    "04": ["W", "PIN not succesfully verified, 3 or more PIN tries left"],
    "08": ["", "Key/file not found"],
    "80": ["W", "Unblock Try Counter has reached zero"],
  },
  "91": {
    "00": ["", "OK"],
    "01": [
      "",
      "States.activity, States.lock Status or States.lockable has wrong value",
    ],
    "02": ["", "Transaction number reached its limit"],
    "0C": ["", "No changes"],
    "0E": ["", "Insufficient NV-Memory to complete command"],
    "1C": ["", "Command code not supported"],
    "1E": ["", "CRC or MAC does not match data"],
    "40": ["", "Invalid key number specified"],
    "7E": ["", "Length of command string invalid"],
    "9D": ["", "Not allow the requested command"],
    "9E": ["", "Value of the parameter invalid"],
    A0: ["", "Requested AID not present on PICC"],
    A1: ["", "Unrecoverable error within application"],
    AE: ["", "Authentication status does not allow the requested command"],
    AF: ["", "Additional data frame is expected to be sent"],
    BE: ["", "Out of boundary"],
    C1: ["", "Unrecoverable error within PICC"],
    CA: ["", "Previous Command was not fully completed"],
    CD: ["", "PICC was disabled by an unrecoverable error"],
    CE: ["", "Number of Applications limited to 28"],
    DE: ["", "File or application already exists"],
    EE: ["", "Could not complete NV-write operation due to loss of power"],
    F0: ["", "Specified file number does not exist"],
    F1: ["", "Unrecoverable error within file"],
  },
};

export function handleAPDUResponse(
  bytes: number[],
  expected: number[] = [0x90, 0x00],
) {
  if (bytes.length < 3) {
    throw new APDUError("Insufficient byte length");
  }

  if (expected.length < 2) {
    expected = [0x90, 0x00];
  }

  if (
    expected[0] !== bytes[bytes.length - 2] ||
    expected[1] !== bytes[bytes.length - 1]
  ) {
    let sw1 = bytes[bytes.length - 2].toString(16).toUpperCase();
    if (sw1.length < 2) {
      sw1 = "0" + sw1;
    }
    let sw2 = bytes[bytes.length - 1].toString(16).toUpperCase();
    if (sw2.length < 2) {
      sw2 = "0" + sw2;
    }

    // TODO: Handle X
    if (
      Object.keys(apduStatusWords).includes(sw1) &&
      Object.keys(apduStatusWords[sw1]).includes(sw2)
    ) {
      const error = apduStatusWords[sw1][sw2];
      let message = "";
      switch (error[0]) {
        case "E":
          message += "(Error) ";
          break;
        case "I":
          message += "(Info) ";
          break;
        case "W":
          message += "(Warning) ";
          break;
      }
      message += error[1];
      throw new APDUError(message);
    } else {
      throw new APDUError(`Unexpected response. Status words: ${sw1}, ${sw2}`);
    }
  }
  return {
    data: bytes.slice(0, bytes.length - 2),
    sw1: bytes[bytes.length - 2],
    sw2: bytes[bytes.length - 1],
  };
}
