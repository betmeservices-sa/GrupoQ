"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { PostComposer } from "@/components/social/PostComposer";
import { PostList } from "@/components/social/PostList";
import { SocialStats } from "@/components/social/SocialStats";
import type { SocialStats as SocialStatsT } from "@/lib/data/types";

export default function RedesPage() {
  const { state, dispatch } = useStore();

  // Stats reales de las cuentas conectadas por OAuth (si el tenant conectó su
  // página). demo:true = sin conexión, se queda el seed del tenant.
  const [reales, setReales] = useState<SocialStatsT[] | null>(null);
  useEffect(() => {
    fetch("/api/meta/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && !d.demo && d.stats?.length) setReales(d.stats);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="flex h-full flex-col">
      <header className="border-b border-line bg-card px-5 py-3">
        <h1 className="text-[17px] font-extrabold tracking-tight text-brand">
          Redes sociales
        </h1>
        <p className="text-[12.5px] text-[#94a3b4]">
          Programa y administra las publicaciones de Facebook e Instagram
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
        <PostComposer
          onProgramar={(red, texto, fecha) =>
            dispatch({ type: "ADD_SOCIAL_POST", red, texto, fecha })
          }
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <SocialStats stats={reales ?? state.socialStats} live={Boolean(reales)} />
          <PostList posts={state.socialPosts} />
        </div>
      </div>
    </div>
  );
}
