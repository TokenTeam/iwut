import { createMMKV } from "react-native-mmkv";

import { NativeRPCErrorType, nativeRPCError } from "../error";
import type {
  NativeRPCResponseData,
  NativeRPCService,
  NativeRPCServiceContext,
} from "../types";

let serviceStorage: ReturnType<typeof createMMKV> | null = null;

export class NativeRPCStorageService implements NativeRPCService {
  readonly name = "storage";

  canHandleMethod(method: string): boolean {
    return method === "set" || method === "get";
  }

  async perform(
    method: string,
    params: Record<string, any> | null | undefined,
    _context: NativeRPCServiceContext,
  ): Promise<NativeRPCResponseData> {
    const key = this.requireKey(params);
    const storage = getServiceStorage();

    if (method === "set") {
      const value = this.resolveValue(params);
      if (value == null) {
        storage.remove(key);
      } else {
        storage.set(key, value);
      }

      return {
        state: true,
      };
    }

    if (method === "get") {
      return {
        value: storage.getString(key) ?? null,
      };
    }

    throw nativeRPCError(NativeRPCErrorType.MethodNotFound);
  }

  private requireKey(params: Record<string, any> | null | undefined): string {
    const key = params?.key;
    if (typeof key !== "string" || key.trim().length === 0) {
      throw nativeRPCError(
        NativeRPCErrorType.InvalidParams,
        "key can not be null",
      );
    }

    return key;
  }

  private resolveValue(
    params: Record<string, any> | null | undefined,
  ): string | null {
    const value = params?.value;
    if (value == null) {
      return null;
    }

    return String(value);
  }
}

function getServiceStorage(): ReturnType<typeof createMMKV> {
  if (serviceStorage) {
    return serviceStorage;
  }

  serviceStorage = createMMKV({ id: "rpc_apps" });
  return serviceStorage;
}
