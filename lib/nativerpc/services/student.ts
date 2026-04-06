import { useUserBindStore } from "@/store/user-bind";

import { NativeRPCErrorType, nativeRPCError } from "../error";
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

    return {
      hasProfile: userBind.isBound,
      name: userBind.studentName,
      studentId: userBind.studentId,
      cardId: userBind.cardId,
      college: userBind.college,
      eduLevel: userBind.eduLevel,
    };
  }
}
