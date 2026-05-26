import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, ShoppingBag, MessageSquare, Plus, User as UserIcon, Headphones } from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function NavBar() {
  const { user, logout } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [, setLocation] = useLocation();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center border border-primary/50 group-hover:shadow-[0_0_15px_rgba(204,0,255,0.5)] transition-shadow">
            <ShoppingBag className="w-5 h-5 text-primary" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white group-hover:text-primary transition-colors">
            Gaytak
          </span>
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-md hidden md:flex relative">
          <Input 
            placeholder="ابحث في Gaytak..." 
            className="w-full bg-black/50 border-white/10 focus-visible:ring-primary/50 focus-visible:border-primary pl-10 h-10 transition-all rounded-full"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
        </form>

        <nav className="flex items-center gap-2 md:gap-4">
          <Link href="/products">
            <Button variant="ghost" className="text-muted-foreground hover:text-white hover:bg-white/5 hidden sm:flex">
              Explore
            </Button>
          </Link>
          
          {user ? (
            <>
              <Link href="/sell">
                <Button className="bg-primary/20 text-primary border border-primary/50 hover:bg-primary/30 hover:shadow-[0_0_15px_rgba(204,0,255,0.4)] transition-all rounded-full hidden sm:flex gap-2">
                  <Plus className="w-4 h-4" />
                  Sell
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-secondary hover:bg-secondary/10 relative">
                  <MessageSquare className="w-5 h-5" />
                  {/* Neon dot for unread could go here */}
                </Button>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8 border border-white/10">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback className="bg-accent/20 text-accent font-medium">{user.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-card border-white/10" align="end" forceMount>
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium text-white">{user.name}</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem asChild className="hover:bg-white/5 cursor-pointer">
                    <Link href="/profile" className="flex w-full items-center">
                      <UserIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="hover:bg-white/5 cursor-pointer">
                    <Link href="/my-listings" className="flex w-full items-center">
                      <ShoppingBag className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>My Listings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="hover:bg-white/5 cursor-pointer">
                    <Link href="/support" className="flex w-full items-center">
                      <Headphones className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span>Support</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem 
                    className="hover:bg-destructive/20 text-destructive cursor-pointer focus:text-destructive focus:bg-destructive/20"
                    onClick={() => logout()}
                  >
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="text-muted-foreground hover:text-white">
                  Login
                </Button>
              </Link>
              <Link href="/register">
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-[0_0_20px_rgba(204,0,255,0.6)] transition-shadow rounded-full">
                  Sign Up
                </Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
