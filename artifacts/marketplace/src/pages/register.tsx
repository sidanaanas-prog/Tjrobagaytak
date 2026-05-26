import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const { login: setAuthToken } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
    },
  });

  const registerMutation = useRegister();

  const onSubmit = (data: RegisterFormValues) => {
    registerMutation.mutate({ data }, {
      onSuccess: (response) => {
        setAuthToken(response.token);
        toast({
          title: "Registration successful!",
          description: "أهلاً بك في Gaytak.",
        });
        setLocation("/");
      },
      onError: (error: any) => {
        toast({
          variant: "destructive",
          title: "Registration failed",
          description: error?.message || "Please check your details and try again.",
        });
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden p-4">
      <div className="absolute top-[20%] right-[20%] w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[20%] left-[20%] w-96 h-96 bg-secondary/20 rounded-full blur-[100px] pointer-events-none" />
      
      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10"
      >
        <Card className="bg-black/40 border-white/10 backdrop-blur-xl shadow-[0_0_50px_rgba(0,255,255,0.15)]">
          <CardHeader className="space-y-1 text-center pb-8">
            <div className="w-12 h-12 bg-accent/20 rounded-xl mx-auto mb-4 flex items-center justify-center border border-accent/50 shadow-[0_0_20px_rgba(0,255,255,0.5)]">
              <Zap className="w-6 h-6 text-accent" />
            </div>
            <CardTitle className="text-3xl font-black tracking-tight text-white">Gaytak</CardTitle>
            <CardDescription className="text-muted-foreground text-base">
              أنشئ حسابك الآن
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">Display Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Zero Cool" 
                          className="bg-black/50 border-white/10 focus-visible:ring-accent focus-visible:border-accent/50 transition-all h-12"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-destructive" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">Email</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="runner@neon.city" 
                          className="bg-black/50 border-white/10 focus-visible:ring-accent focus-visible:border-accent/50 transition-all h-12"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-destructive" />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-white/70">Password</FormLabel>
                      <FormControl>
                        <Input 
                          type="password" 
                          placeholder="••••••••" 
                          className="bg-black/50 border-white/10 focus-visible:ring-accent focus-visible:border-accent/50 transition-all h-12"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage className="text-destructive" />
                    </FormItem>
                  )}
                />
                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-bold bg-accent text-accent-foreground hover:bg-accent/90 hover:shadow-[0_0_20px_rgba(0,255,255,0.6)] transition-all mt-6"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Register Access"
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
          <CardFooter className="flex justify-center border-t border-white/5 pt-6 mt-2">
            <div className="text-sm text-muted-foreground">
              Already connected?{" "}
              <Link href="/login" className="text-accent hover:text-accent/80 font-semibold hover:underline decoration-accent/50 underline-offset-4 transition-all">
                Login here
              </Link>
            </div>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
