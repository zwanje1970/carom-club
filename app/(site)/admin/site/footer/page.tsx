import CardBox from "@/components/admin/_components/CardBox";
import FooterSettingsForm from "@/app/(site)/admin/settings/footer/FooterSettingsForm";

export default function AdminSiteFooterPage() {
  return (
    <div className="space-y-3">
      <CardBox>
        <h1 className="text-lg font-semibold text-site-text">푸터 편집</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-slate-400">
          사이트 하단 푸터 영역을 설정합니다.
        </p>
      </CardBox>
      <FooterSettingsForm cancelHref="/admin/site" />
    </div>
  );
}
