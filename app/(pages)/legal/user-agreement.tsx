import { LegalDocumentScreen } from "@/components/layout/legal-document-screen";
import { USER_AGREEMENT_MARKDOWN_ASSET } from "@/constants/legal-doc-assets";
import { useT } from "@/lib/i18n";

export default function UserAgreementScreen() {
  const t = useT();

  return (
    <LegalDocumentScreen
      title={t("about.userAgreement")}
      markdownAsset={USER_AGREEMENT_MARKDOWN_ASSET}
    />
  );
}
