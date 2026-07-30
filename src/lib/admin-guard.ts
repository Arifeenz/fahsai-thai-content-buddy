import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentUserQuery } from "@/components/app-shell";

export function useRequireAdmin() {
  const navigate = useNavigate();
  const { data, isLoading } = useCurrentUserQuery();
  const isAdmin = data?.user.role === "admin";

  useEffect(() => {
    if (!isLoading && !isAdmin) {
      navigate({ to: "/dashboard" });
    }
  }, [isLoading, isAdmin, navigate]);

  return { ready: !isLoading && isAdmin };
}
