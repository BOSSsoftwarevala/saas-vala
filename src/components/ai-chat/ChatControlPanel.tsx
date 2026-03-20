import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { SlidersHorizontal, Thermometer, Hash, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatControlPanelProps {
  temperature: number;
  maxTokens: number;
  onTemperatureChange: (val: number) => void;
  onMaxTokensChange: (val: number) => void;
}

export function ChatControlPanel({ temperature, maxTokens, onTemperatureChange, onMaxTokensChange }: ChatControlPanelProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="AI Controls">
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-4" side="top" align="start">
        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          AI Parameters
        </h4>

        {/* Temperature */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Thermometer className="h-3 w-3" /> Temperature
            </label>
            <span className={cn(
              "text-xs font-mono font-semibold px-1.5 py-0.5 rounded",
              temperature < 0.3 ? "text-blue-500 bg-blue-500/10" :
              temperature < 0.7 ? "text-green-500 bg-green-500/10" :
              "text-orange-500 bg-orange-500/10"
            )}>
              {temperature.toFixed(1)}
            </span>
          </div>
          <Slider
            value={[temperature]}
            onValueChange={([val]) => onTemperatureChange(val)}
            min={0}
            max={2}
            step={0.1}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Precise</span>
            <span>Balanced</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Hash className="h-3 w-3" /> Max Tokens
            </label>
            <span className="text-xs font-mono font-semibold text-foreground">{maxTokens}</span>
          </div>
          <Slider
            value={[maxTokens]}
            onValueChange={([val]) => onMaxTokensChange(val)}
            min={256}
            max={16384}
            step={256}
            className="w-full"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Short</span>
            <span>Medium</span>
            <span>Long</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
