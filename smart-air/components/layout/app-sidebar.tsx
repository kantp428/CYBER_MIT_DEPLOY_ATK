import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { CloudFog, Home, Settings, Wind, BadgeInfo } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const items = [
  { title: "Home", url: "/", icon: Home },
  { title: "Pollution", url: "/pollution", icon: CloudFog },
  { title: "information", url: "/information", icon: BadgeInfo },
  { title: "settings", url: "/settings", icon: Settings, roles: ["admin"] },
];

  // const [isLogin,setIsLogin] = useState(false);


export function AppSidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadRole = async () => {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (active) {
          setRole(typeof data?.role === "string" ? data.role : null);
        }
      } catch {
        // ignore auth errors here, just hide role-based items
      }
    };

    loadRole();

    return () => {
      active = false;
    };
  }, []);

  const visibleItems = items.filter((item) => {
    if (!item.roles) {
      return true;
    }
    if (!role) {
      return false;
    }
    return item.roles.includes(role);
  });
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="py-4">
        <div
          className="flex items-center gap-3 px-2
          transition-all duration-300
          group-data-[state=collapsed]:justify-center group-data-[state=collapsed]:px-0 w-full"
        >
          <div
            className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm
            transition-transform duration-300"
          >
            <Wind className="size-5" />
          </div>

          <span
            className="font-sans font-bold text-xl tracking-tight whitespace-nowrap
            transition-all duration-300 ease-in-out
            group-data-[state=collapsed]:hidden"
          >
            SMART AIR
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Application</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const isActive =
                  item.url === "/"
                    ? pathname === "/"
                    : pathname === item.url ||
                      pathname.startsWith(`${item.url}/`);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      tooltip={item.title}
                      isActive={isActive}
                    >
                      <Link href={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
