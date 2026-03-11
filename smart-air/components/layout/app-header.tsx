import { SidebarTrigger } from "@/components/ui/sidebar";
import ModeToggle from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function AppHeader() {
  return (
    <>
      <header className="flex h-16 items-center border-b px-6 justify-between bg-background">
        <SidebarTrigger />
        <div className="font-semibold">AI SMART AIR</div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Login</Link>
          </Button>
          <div className="w-8 h-8">
            <ModeToggle />
          </div>
        </div>
      </header>
    </>
  );
}

export default AppHeader;
