"use client";

import React, { useMemo, useState, useEffect } from "react";
import { mdiLogout, mdiClose } from "@mdi/js";
import Icon from "../../../_components/Icon";
import AsideMenuItem from "./Item";
import AsideMenuList from "./List";
import { MenuAsideItem } from "../../../_interfaces";

const MOBILE_MAX = 1023;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return isMobile;
}

function filterMenuForMobile(menu: MenuAsideItem[], isMobile: boolean): MenuAsideItem[] {
  if (!isMobile) return menu;
  return menu.map((item) =>
    item.menu
      ? { ...item, menu: item.menu.filter((m) => !m.hideOnMobile) }
      : item
  );
}

type Props = {
  menu: MenuAsideItem[];
  className?: string;
  onAsideLgCloseClick: () => void;
  onRouteChange: () => void;
  onLogout?: () => void;
};

export default function AsideMenuLayer({ menu, className = "", ...props }: Props) {
  const isMobile = useIsMobile();
  const filteredMenu = useMemo(() => filterMenuForMobile(menu, isMobile), [menu, isMobile]);
  const logoutItem: MenuAsideItem = {
    label: "Logout",
    icon: mdiLogout,
    color: "info",
    isLogout: true,
  };

  const handleAsideLgCloseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    props.onAsideLgCloseClick();
  };

  return (
    <aside
      className={`${className} fixed z-30 flex w-60 overflow-hidden transition-transform duration-200 lg:py-2 lg:pl-2 bg-white lg:bg-slate-900/70 lg:dark:bg-slate-900`}
      style={{ top: "128px", height: "calc(100vh - 128px)" }}
    >
      <div
        className={`aside flex flex-1 flex-col overflow-hidden lg:rounded-2xl dark:bg-slate-900`}
      >
        <div
          className={`aside-brand flex h-14 flex-row items-center justify-between dark:bg-slate-900`}
        >
          <div className="flex-1 text-center lg:pl-6 lg:text-left xl:pl-0 xl:text-center">
            <b className="font-black">CAROM.CLUB</b>
          </div>
          <button
            className="hidden p-3 lg:inline-block xl:hidden"
            onClick={handleAsideLgCloseClick}
          >
            <Icon path={mdiClose} />
          </button>
        </div>
        <div
          className={`aside-scrollbar flex-1 overflow-x-hidden overflow-y-auto dark:scrollbar-styled-dark`}
        >
          <AsideMenuList menu={filteredMenu} onRouteChange={props.onRouteChange} />
        </div>
        <ul>
          <AsideMenuItem item={logoutItem} onRouteChange={props.onRouteChange} onLogout={props.onLogout} />
        </ul>
      </div>
    </aside>
  );
}
