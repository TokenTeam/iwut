import { AppCenterErrorReason } from "./gen/app-center-error-reason";
import { AuthCenterErrorReason } from "./gen/auth-center-error-reason";

export type ApiResponse<T = null> = {
  code: number;
  message: string;
  reason?: AppCenterErrorReason | AuthCenterErrorReason;
  data?: T | null;
  traceId: string;
};
  
export type ApiRequestOptions = {
  token?: string;
  signal?: AbortSignal;
};
