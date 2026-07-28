import { useMemo } from "react";

import { ShareSheet } from "@/components/share/share-sheet";
import { useT } from "@/lib/i18n";
import { buildCourseSingleScanEnvelope } from "@/lib/scan";
import { useCourseStore } from "@/store/course";

export function CourseShareSheet({
  courseName,
  onClose,
}: Readonly<{
  courseName: string | null;
  onClose: () => void;
}>) {
  const t = useT();
  const courses = useCourseStore((s) => s.courses);

  const envelope = useMemo(() => {
    if (!courseName) return null;
    const records = courses.filter((c) => c.name === courseName);
    if (records.length === 0) return null;
    return buildCourseSingleScanEnvelope(records);
  }, [courseName, courses]);

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
