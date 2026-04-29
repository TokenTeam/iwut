export {
  updatePassword,
  deleteAccount,
  getProfile,
  updateProfile,
  getProfileKeys,
  getClaims,
  updateUserConsent,
  setUserDeveloperId,
  revokeAuthorization,
} from "@/lib/api/gen/user";

export type {
  UpdatePasswordRequest,
  GetProfileRequest,
  GetProfileReplyData,
  GetProfileKeysReplyData,
  GetClaimsRequest,
  UpdateUserConsentRequest,
  SetUserDeveloperIdRequest,
  RevokeAuthorizationRequest,
} from "@/lib/api/gen/user";
