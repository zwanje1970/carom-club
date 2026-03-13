/**
 * Admin One 스타일 UI용 타입 (기존 DB/API와 무관)
 */

export type ColorKey =
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "contrast"
  | "light"
  | "dark";

export type ColorButtonKey =
  | "white"
  | "whiteDark"
  | "lightDark"
  | "contrast"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "void";

export type BgKey = "snow" | "concrete" | "pixeled" | "purplePink" | "pinkRed";

export type TrendType = "up" | "down" | "alert" | "success" | "danger" | "warning" | "info";

export interface MenuAsideItem {
  label: string;
  icon?: string;
  href?: string;
  target?: string;
  color?: ColorKey;
  isLogout?: boolean;
  menu?: MenuAsideItem[];
  /** true면 모바일(1024px 미만)에서 메뉴에 표시하지 않음 */
  hideOnMobile?: boolean;
}

export interface MenuNavBarItem {
  icon?: string;
  label?: string;
  href?: string;
  target?: string;
  isDivider?: boolean;
  isCurrentUser?: boolean;
  isDesktopNoLabel?: boolean;
  isToggleLightDark?: boolean;
  isLogout?: boolean;
  menu?: MenuNavBarItemSub[];
}

export interface MenuNavBarItemSub {
  icon?: string;
  label?: string;
  href?: string;
  isDivider?: boolean;
  isLogout?: boolean;
}

export interface Client {
  id: number;
  avatar?: string;
  login: string;
  name: string;
  company: string;
  city: string;
  progress: number;
  created: string;
  created_mdy?: string;
  created_mm_dd_yyyy?: string;
  status?: number;
}

export interface Transaction {
  id: number;
  amount: string;
  client: string;
  date: string;
  type: string;
  business: string;
  name?: string;
  account?: string;
}

export interface UserForm {
  name: string;
  email: string;
}
