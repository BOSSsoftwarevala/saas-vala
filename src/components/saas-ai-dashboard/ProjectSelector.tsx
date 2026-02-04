import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FolderCode } from 'lucide-react';

interface ProjectSelectorProps {
  value: string | null;
  onChange: (value: string) => void;
}

const mockProjects = [
  { id: 'demo-project', name: 'Demo SaaS App', status: 'live' },
  { id: 'ecommerce-v2', name: 'E-Commerce V2', status: 'building' },
  { id: 'crm-system', name: 'CRM System', status: 'failed' },
];

export function ProjectSelector({ value, onChange }: ProjectSelectorProps) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="w-[200px] gap-2">
        <FolderCode className="h-4 w-4 text-muted-foreground" />
        <SelectValue placeholder="Select project" />
      </SelectTrigger>
      <SelectContent>
        {mockProjects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                project.status === 'live' ? 'bg-success' :
                project.status === 'building' ? 'bg-warning' : 'bg-destructive'
              }`} />
              {project.name}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
