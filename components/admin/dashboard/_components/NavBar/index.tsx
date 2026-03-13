"use client";

import React, { ReactNode, useState } from "react";
import { mdiClose, mdiDotsVertical } from "@mdi/js";
import { containerMaxW } from "../../../_lib/config";
import Icon from "../../../_components/Icon";
import NavBarItemPlain from "./Item/Plain";
import NavBarMenuList from "./MenuList";
import { MenuNavBarItem } from "../../../_interfaces";

type Props = {
  menu: MenuNavBarItem[];
  className: string;
  children?: ReactNode;
  userName?: string;
  onLogout?: () => void;
};

export default function NavBar({ menu, className = "", children, userName, onLogout }: Props) {
  const [isMenuNavBarActive, setIsMenuNavBarActive] = useState(false);

  const handleMenuNavBarToggleClick = () => {
    setIsMenuNavBarActive(!isMenuNavBarActive);
  };

  const handleRouteChange = () => {
    setIsMenuNavBarActive(false);
  };

  const hasMenu = menu.length > 0;

  return (
    <nav
      className={`${className} fixed left-0 right-0 z-50 h-16 bg-gray-50 transition-[margin-left] dark:bg-slate-800 shadow-sm shrink-0`}
      style={{ top: "64px", height: "64px" }}
    >
      <div className={`flex lg:items-stretch ${containerMaxW}`}>
        <div className="flex h-16 flex-1 items-stretch">{children}</div>
        {hasMenu && (
          <>
            <div className="flex h-16 flex-none items-stretch lg:hidden">
              <NavBarItemPlain onClick={handleMenuNavBarToggleClick}>
                <Icon path={isMenuNavBarActive ? mdiClose : mdiDotsVertical} size="24" />
              </NavBarItemPlain>
            </div>
            <div
              className={`${
                isMenuNavBarActive ? "block" : "hidden"
              } absolute top-16 left-0 max-h-[calc(100dvh-128px)] w-screen overflow-y-auto bg-gray-50 shadow-lg lg:static lg:flex lg:w-auto lg:overflow-visible lg:shadow-none dark:bg-slate-800 z-40`}
            >
              <NavBarMenuList menu={menu} onRouteChange={handleRouteChange} userName={userName} onLogout={onLogout} />
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
