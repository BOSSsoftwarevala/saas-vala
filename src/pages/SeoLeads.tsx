import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Plus,
  Search,
  TrendingUp,
  Users,
  Mail,
  Phone,
  MoreVertical,
  Download,
  Globe,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

// Mock data
const mockLeads = [
  { id: '1', name: 'John Smith', email: 'john@acme.com', phone: '+1234567890', source: 'Website', status: 'new', createdAt: '2024-02-15' },
  { id: '2', name: 'Sarah Johnson', email: 'sarah@techstore.com', phone: '+0987654321', source: 'Referral', status: 'contacted', createdAt: '2024-02-14' },
  { id: '3', name: 'Mike Brown', email: 'mike@globaltech.com', phone: '+1122334455', source: 'Landing Page', status: 'converted', createdAt: '2024-02-13' },
  { id: '4', name: 'Emily Davis', email: 'emily@retailhub.com', phone: '+5566778899', source: 'Website', status: 'new', createdAt: '2024-02-12' },
  { id: '5', name: 'Chris Wilson', email: 'chris@dataworks.com', phone: '+9988776655', source: 'Campaign', status: 'contacted', createdAt: '2024-02-11' },
];

const leadStatusStyles = {
  new: 'bg-cyan/20 text-cyan border-cyan/30',
  contacted: 'bg-warning/20 text-warning border-warning/30',
  converted: 'bg-success/20 text-success border-success/30',
};

export default function SeoLeads() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('leads');

  const filteredLeads = mockLeads.filter(
    (lead) =>
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              SEO & Lead Manager
            </h2>
            <p className="text-muted-foreground">
              Track leads and optimize your SEO settings
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="gap-2 border-border">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan/20 flex items-center justify-center">
                  <Users className="h-5 w-5 text-cyan" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">342</p>
                  <p className="text-sm text-muted-foreground">Total Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/20 flex items-center justify-center">
                  <Mail className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">89</p>
                  <p className="text-sm text-muted-foreground">Contacted</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">47</p>
                  <p className="text-sm text-muted-foreground">Converted</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card-hover">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">13.8%</p>
                  <p className="text-sm text-muted-foreground">Conv. Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="glass-card rounded-xl p-4">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
              <TabsList className="bg-muted">
                <TabsTrigger value="leads" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Leads
                </TabsTrigger>
                <TabsTrigger value="seo" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  SEO Settings
                </TabsTrigger>
                <TabsTrigger value="forms" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  Lead Forms
                </TabsTrigger>
              </TabsList>

              <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted/50 border-border"
                />
              </div>
            </div>
          </div>

          {/* Leads Tab */}
          <TabsContent value="leads" className="mt-6">
            <div className="glass-card rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="text-muted-foreground">Name</TableHead>
                    <TableHead className="text-muted-foreground">Email</TableHead>
                    <TableHead className="text-muted-foreground">Phone</TableHead>
                    <TableHead className="text-muted-foreground">Source</TableHead>
                    <TableHead className="text-muted-foreground">Status</TableHead>
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="border-border hover:bg-muted/30">
                      <TableCell className="font-medium text-foreground">{lead.name}</TableCell>
                      <TableCell>
                        <a href={`mailto:${lead.email}`} className="text-secondary hover:underline">
                          {lead.email}
                        </a>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.phone}</TableCell>
                      <TableCell className="text-muted-foreground">{lead.source}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn('capitalize', leadStatusStyles[lead.status as keyof typeof leadStatusStyles])}
                        >
                          {lead.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lead.createdAt}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem className="cursor-pointer">View Details</DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">Mark Contacted</DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer">Mark Converted</DropdownMenuItem>
                            <DropdownMenuItem className="cursor-pointer text-destructive">Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* SEO Tab */}
          <TabsContent value="seo" className="mt-6">
            <div className="glass-card rounded-xl p-12 text-center">
              <Globe className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                SEO Settings
              </h3>
              <p className="text-muted-foreground mb-4">
                Configure meta tags, sitemaps, and SEO settings for your products
              </p>
              <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
                Configure SEO
              </Button>
            </div>
          </TabsContent>

          {/* Forms Tab */}
          <TabsContent value="forms" className="mt-6">
            <div className="glass-card rounded-xl p-12 text-center">
              <Plus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-display text-lg font-bold text-foreground mb-2">
                Lead Capture Forms
              </h3>
              <p className="text-muted-foreground mb-4">
                Create custom forms to capture leads from your website
              </p>
              <Button className="bg-orange-gradient hover:opacity-90 text-white gap-2">
                <Plus className="h-4 w-4" />
                Create Form
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
