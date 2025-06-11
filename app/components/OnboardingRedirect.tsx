"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function OnboardingRedirect() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      const user = session?.user;
      if (user && user.provider === 'line' && (!user.phone || !user.birthday)) {
        fetch('/api/partners/self').then(res => res.json()).then(data => {
          if (!data.partner) {
            router.replace("/onboarding");
          }
        });
      }
    }
  }, [session, status, router]);

  return null;
} 