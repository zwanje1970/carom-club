import Link from "next/link";
import type { MenuAsideItem } from "./_interfaces";
import Icon from "./_components/Icon";
import CardBox from "./_components/CardBox";

type Props = {
  menu: MenuAsideItem[];
};

/** 좌측 메뉴와 동일한 항목을 메뉴마다 개별 상자로 표시 (대시보드 화면용) */
export function DashboardMenuBox({ menu }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {menu.map((item, idx) => {
        if (item.isLogout) return null;
        if (item.menu?.length) {
          return (
            <CardBox key={idx}>
              <h3 className="mb-3 text-sm font-semibold text-site-text dark:text-slate-200">
                {item.label}
              </h3>
              <ul className="space-y-1">
                {item.menu.map((sub) => (
                  <li key={`${sub.href ?? "#"}-${sub.label}`}>
                    <Link
                      href={sub.href ?? "#"}
                      className="flex items-center gap-2 rounded-lg py-2 px-2 text-sm text-site-text hover:bg-gray-100 dark:hover:bg-slate-700"
                    >
                      {sub.icon && <Icon path={sub.icon} size={18} />}
                      <span>{sub.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBox>
          );
        }
        if (item.href) {
          return (
            <CardBox key={idx}>
              <Link
                href={item.href}
                className="flex items-center gap-2 rounded-lg py-2 px-2 text-sm font-medium text-site-text hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                {item.icon && <Icon path={item.icon} size={18} />}
                <span>{item.label}</span>
              </Link>
            </CardBox>
          );
        }
        return null;
      })}
    </div>
  );
}
