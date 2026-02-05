 import { ReactNode } from 'react';
 import { ResellerSidebar } from './ResellerSidebar';
 import { ResellerHeader } from './ResellerHeader';
 
 interface ResellerLayoutProps {
   children: ReactNode;
 }
 
 export function ResellerLayout({ children }: ResellerLayoutProps) {
   return (
     <div className="min-h-screen bg-background">
       <ResellerSidebar />
       <div className="pl-16 lg:pl-64 transition-all duration-300">
         <ResellerHeader />
         <main className="min-h-[calc(100vh-4rem)] p-6">
           {children}
         </main>
         {/* Footer */}
         <footer className="border-t border-border py-4 px-6">
           <p className="text-center text-sm text-muted-foreground">
             © 2024 SaaS VALA. Powered by{' '}
             <span className="font-semibold text-primary">SoftwareVala™</span>
           </p>
         </footer>
       </div>
     </div>
   );
 }