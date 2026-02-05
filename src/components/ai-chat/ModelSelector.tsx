 import { Zap, Brain, ChevronDown, Check, Star, Sparkles } from 'lucide-react';
 import { Button } from '@/components/ui/button';
 import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuItem,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
 } from '@/components/ui/dropdown-menu';
 import { Badge } from '@/components/ui/badge';
 import { cn } from '@/lib/utils';
 
 export interface AIModel {
   id: string;
   name: string;
   provider: 'google' | 'openai';
   description: string;
   speed: 'fast' | 'medium' | 'slow';
   quality: 'standard' | 'high' | 'premium';
   isDefault?: boolean;
   isPremium?: boolean;
 }
 
 const availableModels: AIModel[] = [
   {
     id: 'google/gemini-3-flash-preview',
     name: 'Gemini 3 Flash',
     provider: 'google',
     description: 'Fast & balanced - Best for most tasks',
     speed: 'fast',
     quality: 'high',
     isDefault: true,
   },
   {
     id: 'google/gemini-2.5-flash',
     name: 'Gemini 2.5 Flash',
     provider: 'google',
     description: 'Good balance of speed and reasoning',
     speed: 'fast',
     quality: 'standard',
   },
   {
     id: 'google/gemini-2.5-pro',
     name: 'Gemini 2.5 Pro',
     provider: 'google',
     description: 'Top-tier reasoning and analysis',
     speed: 'medium',
     quality: 'premium',
     isPremium: true,
   },
   {
     id: 'google/gemini-3-pro-preview',
     name: 'Gemini 3 Pro',
     provider: 'google',
     description: 'Next-gen advanced reasoning',
     speed: 'medium',
     quality: 'premium',
     isPremium: true,
   },
   {
     id: 'openai/gpt-5',
     name: 'GPT-5',
     provider: 'openai',
     description: 'Most powerful - complex reasoning',
     speed: 'slow',
     quality: 'premium',
     isPremium: true,
   },
   {
     id: 'openai/gpt-5-mini',
     name: 'GPT-5 Mini',
     provider: 'openai',
     description: 'Strong reasoning, faster response',
     speed: 'medium',
     quality: 'high',
   },
   {
     id: 'openai/gpt-5.2',
     name: 'GPT-5.2',
     provider: 'openai',
     description: 'Latest with enhanced capabilities',
     speed: 'medium',
     quality: 'premium',
     isPremium: true,
   },
 ];
 
 interface ModelSelectorProps {
   selectedModel: string;
   onModelChange: (modelId: string) => void;
   className?: string;
 }
 
 export function ModelSelector({ selectedModel, onModelChange, className }: ModelSelectorProps) {
   const currentModel = availableModels.find(m => m.id === selectedModel) || availableModels[0];
 
   const getSpeedIcon = (speed: AIModel['speed']) => {
     switch (speed) {
       case 'fast': return <Zap className="h-3 w-3 text-green-500" />;
       case 'medium': return <Sparkles className="h-3 w-3 text-amber-500" />;
       case 'slow': return <Brain className="h-3 w-3 text-purple-500" />;
     }
   };
 
   return (
     <DropdownMenu>
       <DropdownMenuTrigger asChild>
         <Button
           variant="outline"
           size="sm"
           className={cn(
             "gap-2 h-8 px-3 bg-muted/50 hover:bg-muted border-border",
             className
           )}
         >
           {getSpeedIcon(currentModel.speed)}
           <span className="text-xs font-medium">{currentModel.name}</span>
           <ChevronDown className="h-3 w-3 text-muted-foreground" />
         </Button>
       </DropdownMenuTrigger>
       <DropdownMenuContent align="start" className="w-80">
         <DropdownMenuLabel className="flex items-center gap-2">
           <Brain className="h-4 w-4 text-primary" />
           AI Models
         </DropdownMenuLabel>
         <DropdownMenuSeparator />
         
         {/* Google Models */}
         <DropdownMenuLabel className="text-xs text-muted-foreground">
           Google Gemini
         </DropdownMenuLabel>
         {availableModels.filter(m => m.provider === 'google').map(model => (
           <DropdownMenuItem
             key={model.id}
             onClick={() => onModelChange(model.id)}
             className={cn(
               "flex items-start gap-3 py-2.5 cursor-pointer",
               selectedModel === model.id && "bg-primary/5"
             )}
           >
             <div className="flex-1">
               <div className="flex items-center gap-2">
                 <span className="font-medium text-sm">{model.name}</span>
                 {model.isDefault && (
                   <Badge variant="outline" className="text-[10px] px-1.5 py-0">Default</Badge>
                 )}
                 {model.isPremium && (
                   <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                 )}
               </div>
               <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
             </div>
             <div className="flex items-center gap-1.5">
               {getSpeedIcon(model.speed)}
               {selectedModel === model.id && (
                 <Check className="h-4 w-4 text-primary" />
               )}
             </div>
           </DropdownMenuItem>
         ))}
         
         <DropdownMenuSeparator />
         
         {/* OpenAI Models */}
         <DropdownMenuLabel className="text-xs text-muted-foreground">
           OpenAI GPT
         </DropdownMenuLabel>
         {availableModels.filter(m => m.provider === 'openai').map(model => (
           <DropdownMenuItem
             key={model.id}
             onClick={() => onModelChange(model.id)}
             className={cn(
               "flex items-start gap-3 py-2.5 cursor-pointer",
               selectedModel === model.id && "bg-primary/5"
             )}
           >
             <div className="flex-1">
               <div className="flex items-center gap-2">
                 <span className="font-medium text-sm">{model.name}</span>
                 {model.isPremium && (
                   <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                 )}
               </div>
               <p className="text-xs text-muted-foreground mt-0.5">{model.description}</p>
             </div>
             <div className="flex items-center gap-1.5">
               {getSpeedIcon(model.speed)}
               {selectedModel === model.id && (
                 <Check className="h-4 w-4 text-primary" />
               )}
             </div>
           </DropdownMenuItem>
         ))}
         
         <DropdownMenuSeparator />
         <div className="px-2 py-1.5 text-[10px] text-muted-foreground text-center">
           ⚡ Fast models for quick tasks • ⭐ Premium for complex reasoning
         </div>
       </DropdownMenuContent>
     </DropdownMenu>
   );
 }