import {
  NativeRPCErrorType,
  nativeRPCError,
  nativeRPCErrorFrom,
} from "./error";
import {
  NativeRPCServiceCenter,
  nativeRPCServiceCenter,
} from "./service-center";
import type {
  NativeRPCRequest,
  NativeRPCResponse,
  NativeRPCServiceContext,
} from "./types";

export const NATIVE_RPC_SUCCESS_CODE = 1000;

export class NativeRPCBridge {
  constructor(
    private readonly services: NativeRPCServiceCenter = nativeRPCServiceCenter,
  ) {}

  async handleRawMessage(
    rawMessage: string,
    context: NativeRPCServiceContext = {},
  ): Promise<NativeRPCResponse | null> {
    let request: NativeRPCRequest;

    try {
      request = this.parseRequest(rawMessage);
    } catch {
      return null;
    }

    try {
      return await this.handleRequest(request, context);
    } catch (error: any) {
      const rpcError = nativeRPCErrorFrom(error);
      return {
        _meta: request._meta ?? {},
        method: request.method,
        service: request.service,
        code: rpcError.code,
        message: rpcError.message,
      };
    }
  }

  buildDeliverScript(response: NativeRPCResponse): string {
    const serialized = JSON.stringify(response);
    return `
      (function () {
        if (window.rpcClient && typeof window.rpcClient.onReceive === "function") {
          window.rpcClient.onReceive(${serialized});
        }
      })();
      true;
    `;
  }

  private async handleRequest(
    request: NativeRPCRequest,
    context: NativeRPCServiceContext,
  ): Promise<NativeRPCResponse> {
    if (request.method === "_addEventListener" || request.method === "_removeEventListener") {
      return {
        _meta: request._meta ?? {},
        method: request.method,
        service: request.service,
        code: NATIVE_RPC_SUCCESS_CODE,
        data: null,
      };
    }

    const service = this.services.getService(request.service);
    if (!service) {
      throw nativeRPCError(NativeRPCErrorType.ServiceNotFound);
    }

    if (!service.canHandleMethod(request.method)) {
      throw nativeRPCError(NativeRPCErrorType.MethodNotFound);
    }

    const data = await service.perform(request.method, request.params, context);

    return {
      _meta: request._meta ?? {},
      method: request.method,
      service: request.service,
      code: NATIVE_RPC_SUCCESS_CODE,
      data,
    };
  }

  private parseRequest(rawMessage: string): NativeRPCRequest {
    let parsed: any;

    try {
      parsed = JSON.parse(rawMessage);
    } catch {
      throw nativeRPCError(
        NativeRPCErrorType.InvalidMessage,
        "invalid message",
      );
    }

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw nativeRPCError(NativeRPCErrorType.InvalidMessage);
    }

    const request = parsed as Partial<NativeRPCRequest>;
    if (
      typeof request.method !== "string" ||
      typeof request.service !== "string"
    ) {
      throw nativeRPCError(NativeRPCErrorType.InvalidMessage);
    }

    return {
      _meta:
        request._meta && typeof request._meta === "object"
          ? request._meta
          : {},
      method: request.method,
      service: request.service,
      params:
        request.params && typeof request.params === "object" && !Array.isArray(request.params)
          ? request.params
          : null,
    };
  }
}
