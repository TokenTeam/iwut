import { useMemo } from "react";

import { ShareSheet } from "@/components/share/share-sheet";
import { useT } from "@/lib/i18n";
import { buildCourseSingleScanEnvelope } from "@/lib/scan";
import { type Course, useCourseStore } from "@/store/course";

export function CourseShareSheet({
  courseName,
  records: draftRecords,
  onClose,
}: Readonly<{
  courseName: string | null;
  records?: Course[];
  onClose: () => void;
}>) {
  const t = useT();
  const courses = useCourseStore((s) => s.courses);

  const envelope = useMemo(() => {
    if (!courseName) return null;
    const records =
      draftRecords ?? courses.filter((c) => c.name === courseName);
    if (records.length === 0) return null;
    return buildCourseSingleScanEnvelope(records);
  }, [courseName, courses, draftRecords]);

  if (!envelope) return null;

  return (
    <ShareSheet
      visible
      onClose={onClose}
      title={t("scan.courseShareTitle")}
      description={t("scan.courseShareDesc")}
      envelope={envelope}
    />
  );
}
