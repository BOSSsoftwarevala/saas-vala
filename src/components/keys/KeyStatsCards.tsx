 import { Key, CheckCircle, Ban, Clock, Activity } from 'lucide-react';
 
 interface KeyStats {
   active: number;
   suspended: number;
   expired: number;
   total: number;
 }
 
 interface KeyStatsCardsProps {
   stats: KeyStats;
 }
 
 export function KeyStatsCards({ stats }: KeyStatsCardsProps) {
   const cards = [
     {
       label: 'Active Keys',
       value: stats.active,
       icon: CheckCircle,
       iconBg: 'bg-success/20',
       iconColor: 'text-success',
       valueColor: 'text-success',
     },
     {
       label: 'Suspended Keys',
       value: stats.suspended,
       icon: Ban,
       iconBg: 'bg-warning/20',
       iconColor: 'text-warning',
       valueColor: 'text-warning',
     },
     {
       label: 'Expired Keys',
       value: stats.expired,
       icon: Clock,
       iconBg: 'bg-muted',
       iconColor: 'text-muted-foreground',
       valueColor: 'text-muted-foreground',
     },
     {
       label: 'Total Keys',
       value: stats.total,
       icon: Key,
       iconBg: 'bg-primary/20',
       iconColor: 'text-primary',
       valueColor: 'text-primary',
     },
   ];
 
   return (
     <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
       {cards.map((card) => (
         <div
           key={card.label}
           className="glass-card rounded-xl p-4 flex items-center gap-4"
         >
           <div className={`h-12 w-12 rounded-lg ${card.iconBg} flex items-center justify-center shrink-0`}>
             <card.icon className={`h-6 w-6 ${card.iconColor}`} />
           </div>
           <div>
             <p className={`text-2xl font-bold ${card.valueColor}`}>{card.value}</p>
             <p className="text-sm text-muted-foreground">{card.label}</p>
           </div>
         </div>
       ))}
     </div>
   );
 }