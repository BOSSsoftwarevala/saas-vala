import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NanoCategory {
  id: string;
  name: string;
  description: string;
}

interface MicroCategory {
  id: string;
  name: string;
  nanos: NanoCategory[];
}

interface SubCategory {
  id: string;
  name: string;
  micros: MicroCategory[];
}

export interface MasterCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  description: string;
  aiTasks: string[];
  subs: SubCategory[];
}

interface AiCategoryCardProps {
  category: MasterCategory;
  onRunTask: (categoryId: string, task: string) => void;
}

export function AiCategoryCard({ category, onRunTask }: AiCategoryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [openSubs, setOpenSubs] = useState<string[]>([]);
  const [openMicros, setOpenMicros] = useState<string[]>([]);

  const toggleSub = (subId: string) => {
    setOpenSubs(prev => 
      prev.includes(subId) ? prev.filter(id => id !== subId) : [...prev, subId]
    );
  };

  const toggleMicro = (microId: string) => {
    setOpenMicros(prev => 
      prev.includes(microId) ? prev.filter(id => id !== microId) : [...prev, microId]
    );
  };

  const Icon = category.icon;

  return (
    <Card className="glass-card border-border/50 hover:border-primary/30 transition-all">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn('p-2.5 rounded-xl', category.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-base">{category.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
                </div>
              </div>
              {isOpen ? (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* AI Tasks */}
            <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1">
                <Zap className="h-3 w-3" /> AI Tasks
              </p>
              <div className="flex flex-wrap gap-2">
                {category.aiTasks.map((task, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    variant="outline"
                    className="text-xs h-7"
                    onClick={() => onRunTask(category.id, task)}
                  >
                    {task}
                  </Button>
                ))}
              </div>
            </div>

            {/* Sub Categories */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Sub Categories</p>
              {category.subs.map((sub) => (
                <Collapsible 
                  key={sub.id} 
                  open={openSubs.includes(sub.id)}
                  onOpenChange={() => toggleSub(sub.id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                      <span className="text-sm font-medium">{sub.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {sub.micros.length} micro
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pl-4 mt-2 space-y-2">
                    {sub.micros.map((micro) => (
                      <Collapsible
                        key={micro.id}
                        open={openMicros.includes(micro.id)}
                        onOpenChange={() => toggleMicro(micro.id)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/10 hover:bg-muted/20 transition-colors">
                            <span className="text-sm text-muted-foreground">{micro.name}</span>
                            <Badge variant="outline" className="text-xs">
                              {micro.nanos.length} nano
                            </Badge>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="pl-4 mt-1">
                          <div className="flex flex-wrap gap-1.5">
                            {micro.nanos.map((nano) => (
                              <Badge 
                                key={nano.id} 
                                variant="secondary" 
                                className="text-xs cursor-pointer hover:bg-primary/20"
                                title={nano.description}
                              >
                                {nano.name}
                              </Badge>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
