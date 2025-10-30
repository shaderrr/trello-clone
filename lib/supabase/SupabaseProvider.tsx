"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useSession } from "@clerk/nextjs";

type SupabaseContext = {
  supabase: SupabaseClient | null;
};

const Context = createContext<SupabaseContext | undefined>(undefined);

export default function SupabaseProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const { session, isLoaded: isClerkLoaded } = useSession();

  useEffect(() => {
    // Only initialize Supabase once Clerk is loaded and has a session
    if (isClerkLoaded && session) {
      const createSupabaseClient = async () => {
        const supabaseAccessToken = await session.getToken({
          template: "supabase",
        });

        const client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          {
            global: {
              headers: {
                Authorization: `Bearer ${supabaseAccessToken}`,
              },
            },
          }
        );
        setSupabase(client);
      };
      
      createSupabaseClient();
    }
  }, [session, isClerkLoaded]);
  
  return (
    <Context.Provider value={{ supabase }}>
      {children}
    </Context.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error("useSupabase must be used within a SupabaseProvider");
  }
  return context;
};