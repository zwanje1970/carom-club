/**
 * Admin One 템플릿 호환용 스토어 훅 (실제 상태는 AdminLayout에서 props로 전달)
 */
type AppState = {
  main: { userName: string; userEmail: string };
  darkMode: { isEnabled: boolean };
};

const defaultState: AppState = {
  main: { userName: "", userEmail: "" },
  darkMode: { isEnabled: false },
};

export function useAppSelector<T>(selector: (state: AppState) => T): T {
  return selector(defaultState);
}

export function useAppDispatch(): (_: unknown) => void {
  return () => {};
}
