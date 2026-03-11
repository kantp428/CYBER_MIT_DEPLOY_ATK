import { SidebarTrigger } from "@/components/ui/sidebar";
import ModeToggle from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function AppHeader() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (!active) {
          return;
        }
        setIsAuthed(response.ok);
      } catch {
        if (active) {
          setIsAuthed(false);
        }
      } finally {
        if (active) {
          setIsChecking(false);
        }
      }
    };

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setIsAuthed(false);
      router.push("/login");
    }
  };

  return (
    <>
      <header className="flex h-16 items-center border-b px-6 justify-between bg-background">
        <SidebarTrigger />
        <div className="font-semibold">AI SMART AIR</div>
        <div className="flex items-center gap-3">
          {isChecking ? null : isAuthed ? (
            <Button variant="outline" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Login</Link>
            </Button>
          )}
          <div className="w-8 h-8">
            <ModeToggle />
          </div>
        </div>
      </header>
    </>
  );
}

export default AppHeader;
