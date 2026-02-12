export class MachineIdError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "MachineIdError";
  }
}

export class LicenseError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "LicenseError";
  }
}

export class LicenseValidationError extends LicenseError {
  constructor(message: string, cause?: unknown) {
    super(message, cause);
    this.name = "LicenseValidationError";
  }
}
