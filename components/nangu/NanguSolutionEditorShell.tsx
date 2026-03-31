"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { NanguReadOnlyLayout } from "@/components/nangu/NanguReadOnlyLayout";
import {
  DEFAULT_TABLE_WIDTH,
  DEFAULT_TABLE_HEIGHT,
} from "@/lib/billiard-table-constants";
import type { NanguBallPlacement, ObjectBallColorKey } from "@/lib/nangu-types";

interface BallPos {
  x: number;
  y: number;
}

function normPosForKey(
  key: ObjectBallColorKey,
  cueBallColor: "white" | "yellow",
  cueBall: BallPos,
  reflectionObjectBall: ObjectBallColorKey,
  secondReflectionObjectBall: ObjectBallColorKey,
  objectBallFirstContact: BallPos,
  objectBallSecondContact: BallPos
): BallPos {
  if (key === cueBallColor) return cueBall;
  if (key === reflectionObjectBall) return objectBallFirstContact;
  if (key === secondReflectionObjectBall) return objectBallSecondContact;
  throw new Error(
    `viewerPositionsToPlacement: key ${key} is not cue or a reflection object`
  );
}

/** 재생·해법과 동일: `reflectionObjectBall` / `secondReflectionObjectBall` 키에 좌표를 싣는다(red 고정 슬롯 없음). */
function viewerPositionsToPlacement(
  cueBall: BallPos,
  objectBallFirstContact: BallPos,
  objectBallSecondContact: BallPos,
  reflectionObjectBall: ObjectBallColorKey,
  secondReflectionObjectBall: ObjectBallColorKey,
  cueBallColor: "white" | "yellow" = "white"
): NanguBallPlacement {
  const nonCue = (["red", "yellow", "white"] as const).filter((k) => k !== cueBallColor);
  if (
    secondReflectionObjectBall === reflectionObjectBall ||
    !nonCue.includes(reflectionObjectBall) ||
    !nonCue.includes(secondReflectionObjectBall)
  ) {
    throw new Error(
      "reflectionObjectBall and secondReflectionObjectBall must be the two distinct non-cue keys"
    );
  }
  return {
    cueBall: cueBallColor,
    redBall: normPosForKey(
      "red",
      cueBallColor,
      cueBall,
      reflectionObjectBall,
      secondReflectionObjectBall,
      objectBallFirstContact,
      objectBallSecondContact
    ),
    yellowBall: normPosForKey(
      "yellow",
      cueBallColor,
      cueBall,
      reflectionObjectBall,
      secondReflectionObjectBall,
      objectBallFirstContact,
      objectBallSecondContact
    ),
    whiteBall: normPosForKey(
      "white",
      cueBallColor,
      cueBall,
      reflectionObjectBall,
      secondReflectionObjectBall,
      objectBallFirstContact,
      objectBallSecondContact
    ),
  };
}

interface NanguSolutionEditorShellProps {
  postId: string;
  cueBall: BallPos;
  objectBallFirstContact: BallPos;
  objectBallSecondContact: BallPos;
  reflectionObjectBall: ObjectBallColorKey;
  secondReflectionObjectBall: ObjectBallColorKey;
  cueBallColor?: "white" | "yellow";
}

/**
 * NanguSolutionEditorShell: 해법 제안을 위한 에디터 UI 쉘
 */
export function NanguSolutionEditorShell({
  postId,
  cueBall,
  objectBallFirstContact,
  objectBallSecondContact,
  reflectionObjectBall,
  secondReflectionObjectBall,
  cueBallColor = "white",
}: NanguSolutionEditorShellProps) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSave = async () => {
    if (!description.trim()) {
      alert("해법 설명을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        description,
        pathData: {}, // 드로잉 기능 구현 전 dummy 데이터
        settings: {}, // 드로잉 기능 구현 전 dummy 데이터
      };

      const res = await fetch(`/api/community/nangu/${postId}/solutions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert("해법이 성공적으로 저장되었습니다.");
        router.push(`/community/nangu/${postId}`);
        router.refresh();
      } else {
        const errorData = await res.json();
        alert(errorData.error || "저장에 실패했습니다.");
      }
    } catch (err) {
      console.error(err);
      alert("저장 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const ballPlacement = viewerPositionsToPlacement(
    cueBall,
    objectBallFirstContact,
    objectBallSecondContact,
    reflectionObjectBall,
    secondReflectionObjectBall,
    cueBallColor
  );

  return (
    <div className="space-y-6 bg-slate-900 p-6 rounded-2xl shadow-xl">
      {/* 상단: 원본 배치 뷰어 */}
      <section>
        <h3 className="text-sm font-medium text-slate-400 mb-3 ml-1">문제 공배치 (참고용)</h3>
        <div
          className="relative w-full max-w-full overflow-hidden rounded-lg border border-slate-700"
          style={{
            maxWidth: DEFAULT_TABLE_WIDTH,
            aspectRatio: `${DEFAULT_TABLE_WIDTH} / ${DEFAULT_TABLE_HEIGHT}`,
          }}
        >
          <NanguReadOnlyLayout
            ballPlacement={ballPlacement}
            fillContainer
            embedFill
            orientation="landscape"
            showGrid
            drawStyle="realistic"
            showCueBallSpot
            className="absolute inset-0 w-full h-full rounded-none border-0 overflow-hidden"
          />
        </div>
      </section>

      {/* 중앙: 해법 설명 입력창 */}
      <section className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-slate-300 ml-1">
          해법 설명
        </label>
        <textarea
          id="description"
          rows={5}
          className="w-full p-4 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
          placeholder="이 난구의 해법을 설명해주세요 (당점, 두께, 스트로크 방법 등)..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </section>

      {/* 하단: 저장 버튼 */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all shadow-lg shadow-blue-900/20"
        >
          {isSubmitting ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              저장 중...
            </span>
          ) : (
            "해법 저장"
          )}
        </button>
      </div>
    </div>
  );
}
