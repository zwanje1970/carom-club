import React from "react";
import { MenuNavBarItem } from "../../../_interfaces";
import NavBarItem from "./Item";

type Props = {
  menu: MenuNavBarItem[];
  onRouteChange: () => void;
  onLogout?: () => void;
  userName?: string;
};

export default function NavBarMenuList({ menu, userName, onLogout, ...props }: Props) {
  return (
    <>
      {menu.map((item, index) => (
        <NavBarItem
          key={index}
          item={item}
          onRouteChange={props.onRouteChange}
          onLogout={onLogout}
          userName={userName}
        />
      ))}
    </>
  );
}
