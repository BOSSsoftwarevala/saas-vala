 import { useState } from 'react';
 import { Input } from '@/components/ui/input';
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from '@/components/ui/select';
 import { Search } from 'lucide-react';
 
 interface KeyFilterRowProps {
   searchQuery: string;
   onSearchChange: (query: string) => void;
   statusFilter: string;
   onStatusChange: (status: string) => void;
 }
 
 export function KeyFilterRow({
   searchQuery,
   onSearchChange,
   statusFilter,
   onStatusChange,
 }: KeyFilterRowProps) {
   return (
     <div className="glass-card rounded-xl p-4">
       <div className="flex flex-col md:flex-row gap-4">
         {/* Search Input */}
         <div className="relative flex-1">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Search by key, user, or module..."
             value={searchQuery}
             onChange={(e) => onSearchChange(e.target.value)}
             className="pl-10 bg-muted/50 border-border min-h-[44px]"
           />
         </div>
 
         {/* Status Dropdown */}
         <Select value={statusFilter} onValueChange={onStatusChange}>
           <SelectTrigger className="w-full md:w-48 bg-muted/50 border-border min-h-[44px]">
             <SelectValue placeholder="All Status" />
           </SelectTrigger>
           <SelectContent>
             <SelectItem value="all">All Status</SelectItem>
             <SelectItem value="active">Active</SelectItem>
             <SelectItem value="suspended">Suspended</SelectItem>
             <SelectItem value="expired">Expired</SelectItem>
             <SelectItem value="revoked">Revoked</SelectItem>
           </SelectContent>
         </Select>
       </div>
     </div>
   );
 }