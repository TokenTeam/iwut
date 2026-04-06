export class SpiderException extends Error {
  readonly cause: any;

  constructor(message?: string, cause?: any) {
    super(message);
    this.name = "SpiderException";
    this.cause = cause;
  }
}
