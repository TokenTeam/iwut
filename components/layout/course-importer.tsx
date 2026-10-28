import { router } from "expo-router";
import { forwardRef, useImperativeHandle } from "react";

import { type ImportType, useCourseStore } from "@/store/course";

export interface GetCourseHandle {
  startImport: (type: ImportType) => void;
}

export const GetCourse = forwardRef<GetCourseHandle>(
  function GetCourse(_, ref) {
    useImperativeHandle(ref, () => ({
      startImport(type: ImportType) {
        useCourseStore.setState({ manualImportActive: true });
        router.push({
          pathname: "/browser/course",
          params: { type },
        });
      },
    }));

    return null;
  },
);
