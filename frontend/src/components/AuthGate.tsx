"use client";

import { useEffect, useState } from "react";
import { BoardScreen } from "@/components/BoardScreen";
import { LoginForm } from "@/components/LoginForm";
import { getMe, login, logout } from "@/lib/api";

export const AuthGate = () => {
  const [username, setUsername] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    getMe().then(setUsername);
  }, []);

  const handleLogin = async (name: string, password: string) => {
    const ok = await login(name, password);
    if (ok) {
      setUsername(name);
    }
    return ok;
  };

  const handleLogout = async () => {
    await logout();
    setUsername(null);
  };

  if (username === undefined) {
    return null;
  }
  if (username === null) {
    return <LoginForm onLogin={handleLogin} />;
  }
  return <BoardScreen onLogout={handleLogout} />;
};
