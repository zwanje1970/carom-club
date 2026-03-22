/**
 * 업무 콘솔 공통 UI 컴포넌트 사용 예시 (더미)
 */
import { ConsoleActionBar } from "@/components/client/console/ui/ConsoleActionBar";
import { ConsoleBadge } from "@/components/client/console/ui/ConsoleBadge";
import { ConsoleFilterBar } from "@/components/client/console/ui/ConsoleFilterBar";
import { ConsoleFormPanel } from "@/components/client/console/ui/ConsoleFormPanel";
import { ConsolePageHeader } from "@/components/client/console/ui/ConsolePageHeader";
import { ConsoleSection } from "@/components/client/console/ui/ConsoleSection";
import { ConsoleSummaryPanel } from "@/components/client/console/ui/ConsoleSummaryPanel";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableHead,
  ConsoleTableRow,
  ConsoleTableTd,
  ConsoleTableTh,
} from "@/components/client/console/ui/ConsoleTable";
import { consoleBtnPrimary, consoleBtnSecondary, consoleInputClass, consoleLabelClass } from "@/components/client/console/ui/tokens";

export function ClientConsolePlaceholder({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-4">
      <ConsolePageHeader
        title={title}
        description={description}
        eyebrow="샘플 레이아웃"
        actions={
          <>
            <ConsoleBadge tone="neutral">초안</ConsoleBadge>
            <button type="button" className={consoleBtnSecondary}>
              보조
            </button>
            <button type="button" className={consoleBtnPrimary}>
              주요
            </button>
          </>
        }
      />

      <ConsoleSummaryPanel
        columns={4}
        items={[
          { label: "지표 A", value: 12, hint: "전일 대비" },
          { label: "지표 B", value: 3 },
          { label: "지표 C", value: "—" },
          { label: "지표 D", value: 0 },
        ]}
      />

      <ConsoleFilterBar hint="필터는 한 줄에 배치합니다.">
        <div className="flex min-w-[10rem] flex-col gap-0.5">
          <span className={consoleLabelClass}>검색</span>
          <input className={consoleInputClass} placeholder="키워드" readOnly aria-readonly />
        </div>
        <div className="flex min-w-[6rem] flex-col gap-0.5">
          <span className={consoleLabelClass}>상태</span>
          <select className={consoleInputClass} disabled aria-disabled>
            <option>전체</option>
          </select>
        </div>
      </ConsoleFilterBar>

      <ConsoleSection title="표 형태" description="스크롤은 가로만 허용" flush>
        <ConsoleTable embedded>
          <ConsoleTableHead>
            <tr>
              <ConsoleTableTh>항목</ConsoleTableTh>
              <ConsoleTableTh>상태</ConsoleTableTh>
              <ConsoleTableTh className="text-right">수량</ConsoleTableTh>
            </tr>
          </ConsoleTableHead>
          <ConsoleTableBody>
            <ConsoleTableRow>
              <ConsoleTableTd>예시 행</ConsoleTableTd>
              <ConsoleTableTd>
                <ConsoleBadge tone="success">정상</ConsoleBadge>
              </ConsoleTableTd>
              <ConsoleTableTd className="text-right">1</ConsoleTableTd>
            </ConsoleTableRow>
          </ConsoleTableBody>
        </ConsoleTable>
      </ConsoleSection>

      <ConsoleFormPanel
        title="폼 패널"
        description="필드 그룹을 같은 테두리 안에 둡니다."
        footer={
          <>
            <button type="button" className={consoleBtnSecondary}>
              취소
            </button>
            <button type="button" className={consoleBtnPrimary}>
              저장
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-0.5">
            <label className={consoleLabelClass} htmlFor="demo-field-a">
              필드 A
            </label>
            <input id="demo-field-a" className={consoleInputClass} readOnly />
          </div>
          <div className="flex flex-col gap-0.5">
            <label className={consoleLabelClass} htmlFor="demo-field-b">
              필드 B
            </label>
            <input id="demo-field-b" className={consoleInputClass} readOnly />
          </div>
        </div>
      </ConsoleFormPanel>

      <ConsoleActionBar
        left={<span className="text-zinc-500">필수 항목을 확인한 뒤 저장하세요.</span>}
        right={
          <>
            <button type="button" className={consoleBtnSecondary}>
              임시저장
            </button>
            <button type="button" className={consoleBtnPrimary}>
              등록
            </button>
          </>
        }
      />
    </div>
  );
}
