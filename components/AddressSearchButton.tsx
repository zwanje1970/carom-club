"use client";

import { useCallback } from "react";
import { useDaumPostcodePopup } from "react-daum-postcode";

export type AddressSearchResult = {
  /** 전체 주소 (지번 또는 도로명 + 상세) */
  address: string;
  /** 우편번호 (5자리) */
  zonecode?: string;
  /** 시/도 + 시/군/구 (예: 서울 강남구) - 지역 입력칸 채우기용 */
  region?: string;
};

type AddressSearchButtonProps = {
  onSelect: (result: AddressSearchResult) => void;
  label?: string;
  className?: string;
  type?: "button" | "submit";
};

const POSTCODE_SCRIPT_URL = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js";

export function AddressSearchButton({
  onSelect,
  label = "주소 검색",
  className = "rounded border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
  type = "button",
}: AddressSearchButtonProps) {
  const open = useDaumPostcodePopup(POSTCODE_SCRIPT_URL);

  const handleComplete = useCallback(
    (data: {
      address: string;
      addressType: string;
      bname?: string;
      buildingName?: string;
      zonecode?: string;
      sido?: string;
      sigungu?: string;
    }) => {
      let fullAddress = data.address;
      let extraAddress = "";

      if (data.addressType === "R") {
        if (data.bname !== "") extraAddress += data.bname;
        if (data.buildingName !== "") {
          extraAddress += extraAddress ? `, ${data.buildingName}` : data.buildingName;
        }
        fullAddress += extraAddress ? ` (${extraAddress})` : "";
      }

      const region =
        [data.sido, data.sigungu].filter(Boolean).join(" ") || undefined;

      onSelect({
        address: fullAddress,
        zonecode: data.zonecode,
        region: region || undefined,
      });
    },
    [onSelect]
  );

  const handleClick = useCallback(() => {
    open({ onComplete: handleComplete });
  }, [open, handleComplete]);

  return (
    <button type={type} onClick={handleClick} className={className}>
      {label}
    </button>
  );
}
