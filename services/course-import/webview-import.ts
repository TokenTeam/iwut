import type { BaseImportType } from "./auto-refresh";
import {
  BACHELOR_HOME_PREFIX,
  BACHELOR_LOGIN_URL,
  buildBachelorFetchScript,
  isBachelorCoursesMessage,
  normalizeBachelorCoursesMessage,
} from "./bachelor-import";
import {
  buildMasterFetchScript,
  isMasterRowsMessage,
  MASTER_LOGIN_URL,
  MASTER_MAIN_PREFIX,
  normalizeMasterRowsMessage,
} from "./master-import";

export function getCourseImportPage(type: BaseImportType) {
  return type === "master"
    ? { loginUrl: MASTER_LOGIN_URL, homePrefix: MASTER_MAIN_PREFIX }
    : { loginUrl: BACHELOR_LOGIN_URL, homePrefix: BACHELOR_HOME_PREFIX };
}

export function buildCourseFetchScript(
  type: BaseImportType,
  messages: { fetchUserFailed: string; noTermData: string },
) {
  return type === "master"
    ? buildMasterFetchScript(messages)
    : buildBachelorFetchScript(messages);
}

export function normalizeCourseImportMessage(
  type: BaseImportType,
  message: unknown,
) {
  if (type === "master" && isMasterRowsMessage(message)) {
    return normalizeMasterRowsMessage(message);
  }
  if (type === "bachelor" && isBachelorCoursesMessage(message)) {
    return normalizeBachelorCoursesMessage(message);
  }
  return null;
}
