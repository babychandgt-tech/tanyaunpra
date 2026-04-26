import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  MessageSquare, 
  BrainCircuit, 
  Calendar, 
  CalendarDays, 
  Bell, 
  GraduationCap, 
  Users, 
  BookOpen, 
  Key, 
  LogOut,
  Menu,
  FileText
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
  superAdminOnly?: boolean;
}

const navItems: NavItem[] = [
  { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { title: "Chat Logs", href: "/chat-logs", icon: MessageSquare, roles: ["admin"] },
  { title: "AI Intents", href: "/intents", icon: BrainCircuit, roles: ["admin"] },
  { title: "Jadwal Kuliah", href: "/jadwal", icon: Calendar, roles: ["admin", "dosen"] },
  { title: "Kalender Akademik", href: "/kalender", icon: CalendarDays, roles: ["admin", "dosen", "mahasiswa"] },
  { title: "Pengumuman", href: "/pengumuman", icon: Bell, roles: ["admin", "dosen"] },
  { title: "Data Mahasiswa", href: "/mahasiswa", icon: GraduationCap, roles: ["admin", "dosen"] },
  { title: "Data Dosen", href: "/dosen", icon: Users, roles: ["admin"] },
  { title: "Mata Kuliah", href: "/matkul", icon: BookOpen, roles: ["admin", "dosen"] },
  { title: "API Keys", href: "/settings/api-keys", icon: Key, roles: ["admin"] },
  { title: "Manajemen Admin", href: "/users", icon: Users, roles: ["admin"], superAdminOnly: true },
  { title: "Dokumentasi API", href: "/api-docs", icon: FileText, roles: ["admin"], superAdminOnly: true },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  if (!user) return null;

  const filteredNavItems = navItems.filter(item =>
    item.roles.includes(user.role) && (!item.superAdminOnly || user.isSuperAdmin)
  );

  const NavLinks = () => (
    <div className="space-y-1 py-4">
      {filteredNavItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.href || location.startsWith(`${item.href}/`);
        
        return (
          <Link key={item.href} href={item.href}>
            <span
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              data-testid={`nav-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <Icon className="h-4 w-4" />
              {item.title}
            </span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden fixed top-3 left-4 z-50">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            <div className="flex h-14 items-center border-b px-4">
              <span className="text-lg font-bold">Tanya UNPRA</span>
            </div>
            <div className="flex-1 overflow-auto py-2 px-3">
              <NavLinks />
            </div>
            <div className="p-4 border-t">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                  {user.name.charAt(0)}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate w-36">{user.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
                </div>
              </div>
              <Button variant="outline" className="w-full justify-start text-destructive" onClick={logout} data-testid="button-logout-mobile">
                <LogOut className="mr-2 h-4 w-4" />
                Logout
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Sidebar */}
      <div className="hidden md:flex h-screen w-64 flex-col border-r bg-card fixed left-0 top-0">
        <div className="flex h-14 items-center border-b px-6">
          <span className="text-lg font-bold text-primary">Tanya UNPRA</span>
        </div>
        <div className="flex-1 overflow-auto py-4 px-4">
          <NavLinks />
        </div>
        <div className="p-4 border-t bg-muted/30">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold">
              {user.name.charAt(0)}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate" title={user.name}>{user.name}</span>
              <span className="text-xs text-muted-foreground capitalize">{user.role}</span>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={logout} data-testid="button-logout">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </div>
    </>
  );
}
