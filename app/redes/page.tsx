"use client";

import { useStore } from "@/lib/store";
import { PostComposer } from "@/components/social/PostComposer";
import { PostList } from "@/components/social/PostList";
import { SocialStats } from "@/components/social/SocialStats";

export default function RedesPage() {
  const { state, dispatch } = useStore();

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
          <SocialStats stats={state.socialStats} />
          <PostList posts={state.socialPosts} />
        </div>
      </div>
    </div>
  );
}
