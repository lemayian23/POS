export class ApplicationError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(
    code: string,
    message: string,
    statusCode: number,
  ) {
    super(message);

    this.name = "ApplicationError";
    this.code = code;
    this.statusCode = statusCode;
  }
}