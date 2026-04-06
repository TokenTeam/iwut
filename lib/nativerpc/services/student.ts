import { useUserBindStore } from "@/store/user-bind";

import {
  NativeRPCErrorType,
  nativeRPCError,
} from "../error";
import type {
  NativeRPCResponseData,
  NativeRPCService,
  NativeRPCServiceContext,
} from "../types";

export class NativeRPCStudentService implements NativeRPCService {
  readonly name = "student";

  canHandleMethod(method: string): boolean {
    return method === "profile";
  }

  async perform(
    method: string,
    _params: Record<string, any> | null | undefined,
    _context: NativeRPCServiceContext,
  ): Promise<NativeRPCResponseData> {
    if (method !== "profile") {
      throw nativeRPCError(NativeRPCErrorType.MethodNotFound);
    }

    const userBind = useUserBindStore.getState();

    // TODO Fill out other information of profile
    return {
      hasProfile: userBind.isBound,
      name: userBind.studentName || "",
      studentId: userBind.studentId || "",
      cardId: "123456",
      college: "信息工程学院",
      eduLevel: "本科",
    };
  }
}
