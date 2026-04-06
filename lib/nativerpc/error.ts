export enum NativeRPCErrorType {
  InvalidMessage = 1001,
  InvalidParams = 1002,
  ServiceNotFound = 1003,
  MethodNotFound = 1004,
  ConnectionTypeNotSupported = 1005,
  Unauthorized = 1006,
  AccessDenied = 1007,
  UserDefined = 1008,
}

const DEFAULT_ERROR_MESSAGE: Record<NativeRPCErrorType, string> = {
  [NativeRPCErrorType.InvalidMessage]: "invalid message",
  [NativeRPCErrorType.InvalidParams]: "Invalid parameters",
  [NativeRPCErrorType.ServiceNotFound]: "Service Not Found",
  [NativeRPCErrorType.MethodNotFound]: "Method Not Found",
  [NativeRPCErrorType.ConnectionTypeNotSupported]:
    "Not Supported Connection Type",
  [NativeRPCErrorType.Unauthorized]: "Unauthorized",
  [NativeRPCErrorType.AccessDenied]: "Access denied",
  [NativeRPCErrorType.UserDefined]: "Unknown error",
};

export class NativeRPCError extends Error {
  readonly code: number;
  readonly cause: any;

  constructor(type: NativeRPCErrorType, message?: string, cause?: any) {
    super(message ?? DEFAULT_ERROR_MESSAGE[type]);
    this.name = "NativeRPCError";
    this.code = type;
    this.cause = cause;
  }
}

export function nativeRPCError(
  type: NativeRPCErrorType,
  overrideMessage?: string,
): NativeRPCError {
  return new NativeRPCError(type, overrideMessage);
}

export function nativeRPCErrorFrom(error: any): NativeRPCError {
  if (error instanceof NativeRPCError) {
    return error;
  }

  if (error instanceof Error) {
    return new NativeRPCError(
      NativeRPCErrorType.UserDefined,
      error.message,
      error,
    );
  }

  return new NativeRPCError(
    NativeRPCErrorType.UserDefined,
    "Unknown error",
    error,
  );
}
