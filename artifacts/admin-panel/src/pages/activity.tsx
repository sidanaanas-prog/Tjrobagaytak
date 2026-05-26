import { useGetAdminActivity, getGetAdminActivityQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity as ActivityIcon, User, Box, MessageSquare, Shield, ShoppingBag, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

export default function Activity() {
  const { data: activity, isLoading } = useGetAdminActivity({ query: { queryKey: getGetAdminActivityQueryKey() } });

  const getIconForType = (type: string) => {
    switch (type) {
      case 'user_registered': return <User className="w-4 h-4" />;
      case 'product_listed':
      case 'product_approved':
      case 'product_rejected': return <Box className="w-4 h-4" />;
      case 'message_sent': return <MessageSquare className="w-4 h-4" />;
      case 'order_created': return <ShoppingBag className="w-4 h-4" />;
      case 'order_delivered': return <CheckCircle className="w-4 h-4" />;
      case 'order_cancelled': return <XCircle className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getColorForType = (type: string) => {
    switch (type) {
      case 'product_approved': return 'text-primary border-primary bg-primary/10';
      case 'product_rejected': return 'text-destructive border-destructive bg-destructive/10';
      case 'user_registered': return 'text-blue-400 border-blue-400/50 bg-blue-400/10';
      case 'product_listed': return 'text-yellow-400 border-yellow-400/50 bg-yellow-400/10';
      case 'order_created': return 'text-green-400 border-green-400/50 bg-green-400/10';
      case 'order_delivered': return 'text-primary border-primary bg-primary/10';
      case 'order_cancelled': return 'text-destructive border-destructive bg-destructive/10';
      default: return 'text-muted-foreground border-muted-foreground/30 bg-muted/30';
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-mono font-bold text-primary tracking-wider uppercase">System Logs</h1>
          <p className="text-muted-foreground font-mono text-sm">PLATFORM EVENT STREAM</p>
        </div>
      </div>

      <Card className="border-primary/20 bg-card">
        <CardHeader className="border-b border-border/50 bg-primary/5">
          <CardTitle className="font-mono text-primary flex items-center gap-2 text-base">
            <ActivityIcon className="w-4 h-4" />
            LIVE FEED
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-muted-foreground font-mono">
              CONNECTING TO EVENT STREAM...
            </div>
          ) : !activity?.length ? (
            <div className="p-12 text-center text-muted-foreground font-mono">
              NO EVENTS LOGGED
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[39px] top-0 bottom-0 w-px bg-border/50" />
              
              <div className="divide-y divide-border/20">
                {activity.map((item, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={item.id} 
                    className="p-4 flex gap-4 hover:bg-muted/10 relative z-10"
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border ${getColorForType(item.type)} z-10 shadow-[0_0_10px_currentColor_inset]`}>
                      {getIconForType(item.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0 pt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                        <span className="font-mono font-medium text-foreground tracking-tight">
                          {item.description}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(item.createdAt), "yyyy-MM-dd HH:mm:ss")}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-3 mt-2">
                        <Badge variant="outline" className={`font-mono text-[9px] uppercase tracking-wider ${getColorForType(item.type).split(' ')[0]} ${getColorForType(item.type).split(' ')[1]}`}>
                          {item.type.replace(/_/g, ' ')}
                        </Badge>
                        {item.userName && (
                          <span className="text-xs text-muted-foreground font-mono border-l border-border/50 pl-3">
                            ACTOR: <span className="text-primary/80">{item.userName}</span>
                          </span>
                        )}
                        <span className="text-[10px] text-muted-foreground/50 font-mono ml-auto">
                          ID: {item.id.substring(0, 8)}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
