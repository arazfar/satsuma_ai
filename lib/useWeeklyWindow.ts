import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { getWeeklyWindow } from "./weeklyImport";

export function useWeeklyWindow() {
  const [window, setWindow] = useState(() => getWeeklyWindow());
  const refresh = () => setWindow(getWeeklyWindow());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    function schedule() {
      clearTimeout(timer);
      const now = new Date();
      const midnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
      );
      timer = setTimeout(
        () => {
          setWindow(getWeeklyWindow());
          schedule();
        },
        midnight.getTime() - now.getTime() + 50,
      );
    }
    schedule();
    const listener = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        setWindow(getWeeklyWindow());
        schedule();
      }
    });
    return () => {
      clearTimeout(timer);
      listener.remove();
    };
  }, []);
  return { window, refresh };
}
