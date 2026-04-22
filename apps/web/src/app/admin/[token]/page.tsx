"use client";

import { useEffect, useState } from "react";
import { AdminPanel } from "../../../components/AdminPanel";

type PageParams = {
  params: Promise<{ token: string }>;
};

export default function AdminPage({ params }: PageParams) {
  const [token, setToken] = useState<string | null>(null);

  // Resolve Next.js 15 async params
  useEffect(() => {
    params.then((p) => setToken(decodeURIComponent(p.token)));
  }, [params]);

  if (!token) return null;
  return <AdminPanel token={token} />;
}
