"use client";

import { FormEvent, useEffect, useState } from "react";

function digitsOnlyPhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** 표시·입력: 숫자만 (010-1234-5678 형태) */
function formatPhoneDisplay(digits: string): string {
  const d = digitsOnlyPhone(digits);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 11)}`;
}

type Props = {
  initialName: string;
  initialNickname: string;
  initialEmail: string;
  initialPhone: string;
};

type UpdateResponse = {
  ok?: boolean;
  error?: string;
  user?: {
    name?: string;
    nickname?: string;
    email?: string | null;
    phone?: string | null;
  };
};

export default function ProfileEditForm({
  initialName,
  initialNickname,
  initialEmail,
  initialPhone,
}: Props) {
  const [name, setName] = useState(initialName);
  const [nickname, setNickname] = useState(initialNickname);
  const [nicknameMessage, setNicknameMessage] = useState("");
  const [email] = useState(initialEmail);
  const [phoneDigits, setPhoneDigits] = useState(() => digitsOnlyPhone(initialPhone));

  useEffect(() => {
    setPhoneDigits(digitsOnlyPhone(initialPhone));
  }, [initialPhone]);
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/site/mypage", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          nickname,
          phone: phoneDigits,
          password: newPassword,
          passwordConfirm,
        }),
      });
      const result = (await response.json()) as UpdateResponse;
      if (!response.ok) {
        const err = result.error ?? "";
        if (err === "이미 사용중") {
          setMessage("이미 사용중");
        } else if (err.includes("닉네임") || err.includes("이름") || err.includes("전화") || err.includes("비밀번호")) {
          setMessage(err);
        } else {
          setMessage("실패");
        }
        return;
      }

      setName(result.user?.name ?? name);
      if (typeof result.user?.nickname === "string") {
        setNickname(result.user.nickname);
      }
      setPhoneDigits(digitsOnlyPhone(result.user?.phone != null ? String(result.user.phone) : phoneDigits));
      setNewPassword("");
      setPasswordConfirm("");
      setMessage("저장성공");
    } catch {
      setMessage("실패");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="v3-stack site-profile-edit-form" onSubmit={handleSubmit}>
      <label className="v3-stack">
        <span className="site-profile-edit-label">이름</span>
        <input
          className="site-profile-edit-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="이름"
          autoComplete="name"
        />
      </label>

      <label className="v3-stack">
        <span className="site-profile-edit-label">닉네임 (2~12자)</span>
        <input
          className="site-profile-edit-input"
          value={nickname}
          onChange={(event) => {
            setNickname(event.target.value);
            setNicknameMessage("");
          }}
          onBlur={async () => {
            const trimmed = nickname.trim();
            if (!trimmed) {
              setNicknameMessage("");
              return;
            }
            try {
              const q = encodeURIComponent(nickname);
              const response = await fetch(`/api/auth/check-nickname?nickname=${q}`);
              const data = (await response.json()) as { available?: boolean; error?: string };
              if (!response.ok || !data.available) {
                setNicknameMessage(data.error === "이미 사용중" ? "이미 사용중" : data.error ?? "");
                return;
              }
              setNicknameMessage("");
            } catch {
              setNicknameMessage("");
            }
          }}
          placeholder="닉네임"
          autoComplete="nickname"
        />
        {nicknameMessage ? <span className="v3-muted">{nicknameMessage}</span> : null}
      </label>

      <label className="v3-stack">
        <span className="site-profile-edit-label">이메일 (읽기 전용)</span>
        <input
          className="site-profile-edit-input site-profile-edit-input--readonly"
          value={email}
          readOnly
          autoComplete="email"
        />
      </label>

      <label className="v3-stack">
        <span className="site-profile-edit-label">전화번호</span>
        <input
          className="site-profile-edit-input"
          type="tel"
          name="phone"
          value={formatPhoneDisplay(phoneDigits)}
          onChange={(event) => setPhoneDigits(digitsOnlyPhone(event.target.value))}
          placeholder="010-1234-5678"
          autoComplete="tel"
          inputMode="numeric"
        />
      </label>

      <label className="v3-stack">
        <span className="site-profile-edit-label">새 비밀번호</span>
        <input
          className="site-profile-edit-input"
          type="password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="변경 시에만 입력"
          autoComplete="new-password"
        />
      </label>

      <label className="v3-stack">
        <span className="site-profile-edit-label">비밀번호 확인</span>
        <input
          className="site-profile-edit-input"
          type="password"
          value={passwordConfirm}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          placeholder="새 비밀번호 확인"
          autoComplete="new-password"
        />
      </label>

      <button type="submit" className="primary-button primary-button--block" disabled={loading}>
        {loading ? "저장 중..." : "저장"}
      </button>

      {message ? <p className="v3-muted">{message}</p> : null}
    </form>
  );
}
