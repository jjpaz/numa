// The signed-in session and the small data hook every portal uses.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { api, getToken } from "./api";
import { pollWhileVisible } from "./polling";
import type { Health, User } from "./types";

export const Auth = createContext<{
  user: User | null;
  health: Health | null;
  login: (email: string, password: string) => Promise<User>;
  demoLogin: (
    name: string,
    role: "patient" | "psychologist",
    sample: boolean,
  ) => Promise<User>;
  logout: () => void;
}>({
  user: null,
  health: null,
  login: async () => {
    throw Error();
  },
  demoLogin: async () => {
    throw Error();
  },
  logout: () => {},
});
export const useAuth = () => useContext(Auth);

/* The last answer for each path, per session token. A page that opens again
   (or opens inside a view transition) shows what it had at once, then
   refreshes. A different session never sees another session's data. */
const lastSeen = new Map<string, unknown>();
const cacheKey = (path: string) => (getToken() ?? "") + " " + path;

export function useResource<T>(path: string, interval = 0) {
  const [data, setData] = useState<T | null>(
      () => (lastSeen.get(cacheKey(path)) as T | undefined) ?? null,
    ),
    [error, setError] = useState("");
  const active = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++active.current;
    try {
      const result = await api<T>(path);
      if (id === active.current) {
        lastSeen.set(cacheKey(path), result);
        setData(result);
        setError("");
      }
    } catch (e) {
      if (id === active.current) setError((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    setData((lastSeen.get(cacheKey(path)) as T | undefined) ?? null);
    const stopPolling = pollWhileVisible(refresh, interval);
    return () => {
      active.current++;
      stopPolling();
    };
  }, [refresh, interval, path]);
  return { data, error, refresh };
}
