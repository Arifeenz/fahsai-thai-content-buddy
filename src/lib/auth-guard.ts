import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentUserQuery } from "@/components/app-shell";

export function useRequireAuth() {
  const navigate = useNavigate();
  const { data, isLoading } = useCurrentUserQuery();
  const isAuthenticated = !!data?.user;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate({ to: "/" });
    }
  }, [isLoading, isAuthenticated, navigate]);

  return { ready: !isLoading && isAuthenticated };
}
