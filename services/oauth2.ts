export {
  authorize,
  getToken,
  getUserProfile,
  setUserStorage,
} from "@/lib/api/gen/oauth2";

export type {
  AuthorizeRequest,
  AuthorizeReplyData,
  GetTokenRequest,
  GetTokenReply,
  GetUserProfileRequest,
  UserProfileData,
  Scope,
  Storage,
} from "@/lib/api/gen/oauth2";
