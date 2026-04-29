export {
  passwordLogin,
  getRegisterMail,
  getResetUrlMail,
  register,
  resetPassword,
  refreshToken,
} from "@/lib/api/gen/auth";

export type {
  LoginRequest,
  LoginReplyData,
  GetVerifyCodeRequest,
  GetResetUrlRequest,
  RegisterRequest,
  RegisterReplyData,
  ResetPasswordRequest,
  RefreshTokenRequest,
  RefreshTokenReplyData,
} from "@/lib/api/gen/auth";
