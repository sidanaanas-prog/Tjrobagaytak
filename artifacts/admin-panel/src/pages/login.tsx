import { useState } from "react";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/hooks/use-admin-auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Activity, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

const loginSchema = z.object({
  email: z.string().email("Invalid system credential"),
  password: z.string().min(1, "Passcode required"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAdminAuth();
  const [error, setError] = useState("");

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    try {
      setError("");
      const response = await login({ data });
      if (response.user.role !== "admin") {
        setError("ACCESS DENIED: Insufficient clearance level");
        return;
      }
      localStorage.setItem("glow_admin_token", response.token);
      setLocation("/dashboard");
    } catch (err: any) {
      setError(err.message || "AUTHENTICATION FAILED");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden dark">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      
      {/* Decorative grid pattern */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHBhdGggZD0iTTAgMGg0MHY0MEgweiIgZmlsbD0ibm9uZSIvPjxwYXRoIGQ9Ik0wIDM5LjVoNDBWMHptMzkuNSAwVjBoLjV2NDB6IiBmaWxsPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIi8+PC9zdmc+')] [mask-image:linear-gradient(to_bottom,white,transparent)]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md p-8 bg-card border border-primary/20 rounded-lg shadow-[0_0_50px_rgba(0,255,255,0.1)] relative z-10 backdrop-blur-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center border border-primary/50 mb-4 shadow-[0_0_20px_rgba(0,255,255,0.2)]">
            <Activity className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-mono font-bold text-primary tracking-widest uppercase">GAYTAK_ADMIN</h1>
          <p className="text-sm font-mono text-muted-foreground mt-2">SECURE ACCESS TERMINAL</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive text-destructive rounded flex items-start gap-3 text-sm font-mono uppercase">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-primary/70 uppercase text-xs tracking-wider">Operator ID</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="admin@gaytak.com" 
                      className="font-mono bg-background/50 border-primary/30 focus-visible:ring-primary/50 text-primary placeholder:text-primary/30" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="font-mono text-xs" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-mono text-primary/70 uppercase text-xs tracking-wider">Access Code</FormLabel>
                  <FormControl>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      className="font-mono bg-background/50 border-primary/30 focus-visible:ring-primary/50 text-primary placeholder:text-primary/30 tracking-[0.2em]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="font-mono text-xs" />
                </FormItem>
              )}
            />
            <Button 
              type="submit" 
              className="w-full font-mono uppercase tracking-widest bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(0,255,255,0.4)]"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "AUTHENTICATING..." : "INITIALIZE SESSION"}
            </Button>
          </form>
        </Form>
      </motion.div>
    </div>
  );
}
