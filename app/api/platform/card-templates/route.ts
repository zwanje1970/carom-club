import { NextResponse } from "next/server";
import { getAdminCopy } from "@/lib/admin-copy-server";
import {
  PLATFORM_CARD_TEMPLATE_POLICIES,
  resolvePlatformCardTemplatePolicies,
} from "@/lib/platform-card-templates";

export async function GET() {
  try {
    const copy = await getAdminCopy();
    const list = resolvePlatformCardTemplatePolicies(copy);
    return NextResponse.json(
      list.map((item) => ({
        templateType: item.templateType,
        label: item.label,
        isActive: item.isActive,
        showDetailButton: item.showDetailButton,
        fields: item.fields,
      }))
    );
  } catch {
    return NextResponse.json(
      PLATFORM_CARD_TEMPLATE_POLICIES.map((item) => ({
        templateType: item.templateType,
        label: item.label,
        isActive: item.isActive,
        showDetailButton: item.showDetailButton,
        fields: item.fields,
      }))
    );
  }
}
