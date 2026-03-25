export function shouldHideGlobalChromeByPathname(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname.startsWith("/client");
}
