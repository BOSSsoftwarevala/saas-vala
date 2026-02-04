import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  FileText, 
  Code, 
  Image, 
  Mic, 
  Video, 
  Database, 
  Shield, 
  Server,
  ChevronRight,
  Edit2,
  Trash2,
  Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

interface AiCategory {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  level: 'master' | 'sub' | 'micro' | 'nano';
  parentId?: string;
  children?: AiCategory[];
  count?: number;
}

const masterCategories: AiCategory[] = [
  {
    id: 'text-ai',
    name: 'Text AI',
    icon: FileText,
    level: 'master',
    count: 156,
    children: [
      {
        id: 'text-ai-english',
        name: 'English',
        icon: FileText,
        level: 'sub',
        parentId: 'text-ai',
        count: 48,
        children: [
          {
            id: 'text-ai-english-generation',
            name: 'Content Generation',
            icon: FileText,
            level: 'micro',
            parentId: 'text-ai-english',
            count: 12,
            children: [
              { id: 'text-ai-english-generation-blog', name: 'Blog Writing', icon: FileText, level: 'nano', count: 5 },
              { id: 'text-ai-english-generation-seo', name: 'SEO Content', icon: FileText, level: 'nano', count: 4 },
              { id: 'text-ai-english-generation-social', name: 'Social Media', icon: FileText, level: 'nano', count: 3 }
            ]
          },
          {
            id: 'text-ai-english-analysis',
            name: 'Text Analysis',
            icon: FileText,
            level: 'micro',
            parentId: 'text-ai-english',
            count: 8,
            children: [
              { id: 'text-ai-english-analysis-sentiment', name: 'Sentiment', icon: FileText, level: 'nano', count: 3 },
              { id: 'text-ai-english-analysis-summary', name: 'Summary', icon: FileText, level: 'nano', count: 5 }
            ]
          }
        ]
      },
      {
        id: 'text-ai-multilingual',
        name: 'Multilingual',
        icon: FileText,
        level: 'sub',
        parentId: 'text-ai',
        count: 32
      }
    ]
  },
  {
    id: 'code-ai',
    name: 'Code AI',
    icon: Code,
    level: 'master',
    count: 234,
    children: [
      {
        id: 'code-ai-php',
        name: 'PHP',
        icon: Code,
        level: 'sub',
        parentId: 'code-ai',
        count: 45,
        children: [
          {
            id: 'code-ai-php-debug',
            name: 'Debug & Fix',
            icon: Code,
            level: 'micro',
            count: 18,
            children: [
              { id: 'code-ai-php-debug-bug', name: 'Bug Fix', icon: Code, level: 'nano', count: 8 },
              { id: 'code-ai-php-debug-error', name: 'Error Fix', icon: Code, level: 'nano', count: 6 },
              { id: 'code-ai-php-debug-security', name: 'Security Fix', icon: Code, level: 'nano', count: 4 }
            ]
          },
          {
            id: 'code-ai-php-generate',
            name: 'Code Generation',
            icon: Code,
            level: 'micro',
            count: 15,
            children: [
              { id: 'code-ai-php-generate-api', name: 'API Generate', icon: Code, level: 'nano', count: 7 },
              { id: 'code-ai-php-generate-crud', name: 'CRUD Generate', icon: Code, level: 'nano', count: 8 }
            ]
          }
        ]
      },
      {
        id: 'code-ai-javascript',
        name: 'JavaScript/TypeScript',
        icon: Code,
        level: 'sub',
        parentId: 'code-ai',
        count: 67
      },
      {
        id: 'code-ai-python',
        name: 'Python',
        icon: Code,
        level: 'sub',
        parentId: 'code-ai',
        count: 52
      }
    ]
  },
  {
    id: 'image-ai',
    name: 'Image AI',
    icon: Image,
    level: 'master',
    count: 89,
    children: [
      { id: 'image-ai-generation', name: 'Generation', icon: Image, level: 'sub', count: 34 },
      { id: 'image-ai-editing', name: 'Editing', icon: Image, level: 'sub', count: 28 },
      { id: 'image-ai-analysis', name: 'Analysis', icon: Image, level: 'sub', count: 27 }
    ]
  },
  {
    id: 'voice-ai',
    name: 'Voice AI',
    icon: Mic,
    level: 'master',
    count: 45,
    children: [
      { id: 'voice-ai-tts', name: 'Text-to-Speech', icon: Mic, level: 'sub', count: 18 },
      { id: 'voice-ai-stt', name: 'Speech-to-Text', icon: Mic, level: 'sub', count: 15 },
      { id: 'voice-ai-clone', name: 'Voice Clone', icon: Mic, level: 'sub', count: 12 }
    ]
  },
  {
    id: 'video-ai',
    name: 'Video AI',
    icon: Video,
    level: 'master',
    count: 28,
    children: [
      { id: 'video-ai-generation', name: 'Generation', icon: Video, level: 'sub', count: 12 },
      { id: 'video-ai-editing', name: 'Editing', icon: Video, level: 'sub', count: 10 },
      { id: 'video-ai-analysis', name: 'Analysis', icon: Video, level: 'sub', count: 6 }
    ]
  },
  {
    id: 'data-ai',
    name: 'Data AI',
    icon: Database,
    level: 'master',
    count: 67,
    children: [
      { id: 'data-ai-analytics', name: 'Analytics', icon: Database, level: 'sub', count: 28 },
      { id: 'data-ai-extraction', name: 'Extraction', icon: Database, level: 'sub', count: 22 },
      { id: 'data-ai-prediction', name: 'Prediction', icon: Database, level: 'sub', count: 17 }
    ]
  },
  {
    id: 'security-ai',
    name: 'Security AI',
    icon: Shield,
    level: 'master',
    count: 34,
    children: [
      { id: 'security-ai-scan', name: 'Threat Scan', icon: Shield, level: 'sub', count: 14 },
      { id: 'security-ai-fix', name: 'Auto Fix', icon: Shield, level: 'sub', count: 12 },
      { id: 'security-ai-audit', name: 'Security Audit', icon: Shield, level: 'sub', count: 8 }
    ]
  },
  {
    id: 'devops-ai',
    name: 'DevOps AI',
    icon: Server,
    level: 'master',
    count: 56,
    children: [
      { id: 'devops-ai-deploy', name: 'Auto Deploy', icon: Server, level: 'sub', count: 22 },
      { id: 'devops-ai-monitor', name: 'Monitoring', icon: Server, level: 'sub', count: 18 },
      { id: 'devops-ai-scale', name: 'Auto Scale', icon: Server, level: 'sub', count: 16 }
    ]
  }
];

const levelColors = {
  master: 'bg-primary/10 text-primary border-primary/20',
  sub: 'bg-secondary/10 text-secondary border-secondary/20',
  micro: 'bg-accent/10 text-accent border-accent/20',
  nano: 'bg-muted text-muted-foreground border-border'
};

const levelLabels = {
  master: 'MASTER',
  sub: 'SUB',
  micro: 'MICRO',
  nano: 'NANO'
};

interface CategoryItemProps {
  category: AiCategory;
  depth: number;
}

function CategoryItem({ category, depth }: CategoryItemProps) {
  const Icon = category.icon;
  const hasChildren = category.children && category.children.length > 0;

  if (!hasChildren) {
    return (
      <div
        className={`flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors group`}
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{category.name}</span>
          <Badge variant="outline" className={`text-[10px] ${levelColors[category.level]}`}>
            {levelLabels[category.level]}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{category.count} tasks</span>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Edit2 className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <Trash2 className="h-3 w-3 text-destructive" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AccordionItem value={category.id} className="border-none">
      <AccordionTrigger 
        className="py-2 px-3 rounded-lg hover:bg-muted/50 hover:no-underline"
        style={{ marginLeft: `${depth * 16}px` }}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">{category.name}</span>
          <Badge variant="outline" className={`text-[10px] ${levelColors[category.level]}`}>
            {levelLabels[category.level]}
          </Badge>
          <span className="text-xs text-muted-foreground ml-2">{category.count} tasks</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pb-0">
        {category.children?.map(child => (
          <CategoryItem key={child.id} category={child} depth={depth + 1} />
        ))}
      </AccordionContent>
    </AccordionItem>
  );
}

export function AiCategoryManager() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const handleAddCategory = () => {
    toast.success('Category added successfully');
    setIsAddDialogOpen(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
    >
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg">AI Category Structure</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              4-Level Hierarchy: Master → Sub → Micro → Nano
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {Object.entries(levelColors).map(([level, color]) => (
                <Badge key={level} variant="outline" className={`text-[10px] ${color}`}>
                  {levelLabels[level as keyof typeof levelLabels]}
                </Badge>
              ))}
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Category
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add AI Category</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Category Name</Label>
                    <Input placeholder="e.g., Translation AI" />
                  </div>
                  <div className="space-y-2">
                    <Label>Level</Label>
                    <Select defaultValue="sub">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="master">MASTER</SelectItem>
                        <SelectItem value="sub">SUB</SelectItem>
                        <SelectItem value="micro">MICRO</SelectItem>
                        <SelectItem value="nano">NANO</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Parent Category (Optional)</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select parent..." />
                      </SelectTrigger>
                      <SelectContent>
                        {masterCategories.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleAddCategory}>Add Category</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-1">
            {masterCategories.map(category => (
              <CategoryItem key={category.id} category={category} depth={0} />
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </motion.div>
  );
}
