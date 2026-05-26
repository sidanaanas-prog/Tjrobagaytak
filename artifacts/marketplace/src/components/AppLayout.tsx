import { BottomNav } from "./BottomNav";

interface AppLayoutProps {
  children: React.ReactNode;
  hideNav?: boolean;
}

export function AppLayout({ children, hideNav = false }: AppLayoutProps) {
  return (
    <div className={`relative max-w-lg mx-auto bg-background overflow-x-hidden ${hideNav ? "h-[100dvh]" : "flex flex-col min-h-screen"}`}>
      <main className={`${hideNav ? "h-full overflow-hidden" : "flex-1 overflow-y-auto pb-[68px]"}`}>
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
