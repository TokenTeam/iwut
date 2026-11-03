import { useUserBindStore } from "@/store/user-bind";

import { isFunctionVisible } from "./index";
import type { FilterUser, WebApp } from "./types";

export function useFunctionUser(): FilterUser {
  const isBound = useUserBindStore((s) => s.isBound);
  const studentId = useUserBindStore((s) => s.studentId);
  const college = useUserBindStore((s) => s.college);
  const eduLevel = useUserBindStore((s) => s.eduLevel);
  const cardId = useUserBindStore((s) => s.cardId);
  return { isBound, studentId, college, eduLevel, cardId };
}

export function canOpenApp(app: WebApp): boolean {
  const user = useUserBindStore.getState();
  return user.isBound && isFunctionVisible(app, user);
}

export function subscribeFunctionUser(
  listener: (next: FilterUser, previous: FilterUser) => void,
) {
  return useUserBindStore.subscribe(listener);
}
