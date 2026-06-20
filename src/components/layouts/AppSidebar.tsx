import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LayoutDashboard, Package, Leaf, UtensilsCrossed, ChefHat,
  BarChart3, ShoppingCart, Menu, LogOut, User, CreditCard,
} from 'lucide-react';
import { AvatarIcon } from '@/components/common/AvatarIcon';
import { getAllActiveCookingSessions } from '@/lib/api';

const BASE_NAV_ITEMS = [
  { label: 'Dashboard',    icon: LayoutDashboard, path: '/dashboard' },
  { label: 'Inventory',    icon: Package,          path: '/inventory'  },
  { label: 'Fermentation', icon: Leaf,             path: '/fermentation' },
  { label: 'Meal Planning',icon: UtensilsCrossed,  path: '/meal-planning' },
  { label: 'Cook',         icon: ChefHat,          path: '/cooking',  dynamic: true },
  { label: 'Nutrition',    icon: BarChart3,         path: '/nutrition'  },
  { label: 'Grocery List', icon: ShoppingCart,     path: '/grocery'    },
];

function NavLinks({ onNavigate, cookingPath }: { onNavigate?: () => void; cookingPath: string }) {
  const location = useLocation();
  return (
    <nav className="flex flex-col gap-1 px-2">
      {BASE_NAV_ITEMS.map(item => {
        const resolvedPath = item.dynamic ? cookingPath : item.path;
        const active = location.pathname === item.path ||
          location.pathname.startsWith(item.path + '/') ||
          (item.dynamic && location.pathname.startsWith('/cooking'));
        return (
          <Link
            key={item.path}
            to={resolvedPath}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
              active
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
            )}
          >
            <item.icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const initials = profile?.username?.slice(0, 2).toUpperCase() ?? 'PC';
  const [cookingPath, setCookingPath] = useState('/cooking');

  // Resolve the most recent live cooking session for the nav link
  useEffect(() => {
    if (!user) return;
    getAllActiveCookingSessions(user.id).then(sessions => {
      if (sessions.length > 0 && sessions[0].room_code) {
        setCookingPath(`/cooking/${sessions[0].room_code}`);
      } else {
        setCookingPath('/cooking');
      }
    }).catch(() => {});
  }, [user]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-5">
        <img
          src="https://miaoda-edit-image.s3cdn.medo.dev/cefpj3nj5mgx/IMG-cfn0d0wuv37k.png"
          alt="Pochef"
          className="h-9 w-9 rounded-xl"
          data-editor-config="%7B%22defaultSrc%22%3A%22https%3A%2F%2Fmiaoda-edit-image.s3cdn.medo.dev%2Fcefpj3nj5mgx%2FIMG-cfn0d0wuv37k.png%22%7D" />
        <div>
          <h1 className="text-base font-bold gradient-text leading-tight">Pochef</h1>
          <p className="text-xs text-muted-foreground">Your Digital Kitchen Twin</p>
        </div>
      </div>
      <Separator className="mx-4 mb-3 w-auto" />
      {/* Nav */}
      <div className="flex-1 overflow-y-auto py-1">
        <NavLinks onNavigate={onNavigate} cookingPath={cookingPath} />
      </div>
      <Separator className="mx-4 mt-3 w-auto" />
      {/* User */}
      <div className="p-3">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold p-0">
                  <AvatarIcon avatarType={profile?.avatar_type ?? 'initials'} initials={initials} size={32} />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-sm font-medium text-sidebar-foreground truncate">
                  {profile?.username ?? 'Chef'}
                </p>
                <p className="text-xs text-muted-foreground truncate capitalize">
                  {profile?.plan === 'trial' ? 'Pro Trial' : (profile?.plan ?? 'free')}
                </p>
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/preferences" onClick={onNavigate}><User className="h-4 w-4 mr-2" />Preferences</Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/pricing" onClick={onNavigate}><CreditCard className="h-4 w-4 mr-2" />Pricing</Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
              <LogOut className="h-4 w-4 mr-2" />Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function AppSidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r border-sidebar-border">
        <SidebarContent />
      </aside>

      {/* Mobile Hamburger */}
      <div className="lg:hidden fixed top-3 left-3 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 glass border border-white/60 text-foreground hover:bg-white/10"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0 bg-sidebar">
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
