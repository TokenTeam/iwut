import { LegalDocumentScreen } from "@/components/layout/legal-document-screen";
import { PRIVACY_POLICY_MARKDOWN_ASSET } from "@/constants/legal-doc-assets";
import { useT } from "@/lib/i18n";

export default function PrivacyPolicyScreen() {
  const t = useT();

  return (
    <LegalDocumentScreen
      title={t("about.privacyPolicy")}
      markdownAsset={PRIVACY_POLICY_MARKDOWN_ASSET}
    />
  );
}
