import { 
  Package, 
  Code, 
  Rocket, 
  Shield, 
  TrendingUp, 
  Wallet, 
  Headphones, 
  BarChart3 
} from 'lucide-react';
import { AiCategoryCard, MasterCategory } from './AiCategoryCard';

const AI_CATEGORIES: MasterCategory[] = [
  {
    id: 'product-ai',
    name: 'Product AI',
    icon: Package,
    color: 'bg-primary/20 text-primary',
    description: 'Product understanding & validation',
    aiTasks: ['Read product data', 'Suggest improvements', 'Detect missing flows', 'Ensure buttons work'],
    subs: [
      {
        id: 'product-understanding',
        name: 'Product Understanding',
        micros: [
          { id: 'feature-analysis', name: 'Feature Analysis', nanos: [
            { id: 'button-mapping', name: 'Button Mapping', description: 'Map all button actions' },
            { id: 'field-validation', name: 'Field Validation', description: 'Validate form fields' },
          ]},
          { id: 'module-mapping', name: 'Module Mapping', nanos: [
            { id: 'missing-feature', name: 'Missing Feature Detection', description: 'Detect missing features' },
          ]},
        ]
      },
      {
        id: 'product-planning',
        name: 'Product Planning',
        micros: [
          { id: 'dependency-check', name: 'Dependency Check', nanos: [
            { id: 'version-check', name: 'Version Check', description: 'Check dependency versions' },
          ]},
        ]
      },
      {
        id: 'product-validation',
        name: 'Product Validation',
        micros: [
          { id: 'flow-validation', name: 'Flow Validation', nanos: [
            { id: 'user-journey', name: 'User Journey', description: 'Validate user journeys' },
          ]},
        ]
      },
    ]
  },
  {
    id: 'code-ai',
    name: 'Code & File AI',
    icon: Code,
    color: 'bg-cyan/20 text-cyan',
    description: 'Code analysis, conversion & repair',
    aiTasks: ['Upload code', 'Auto extract & scan', 'Auto fix errors', 'Convert language'],
    subs: [
      {
        id: 'code-analysis',
        name: 'Code Analysis',
        micros: [
          { id: 'php-js-python', name: 'PHP / JS / Python / Java', nanos: [
            { id: 'syntax-fix', name: 'Syntax Fix', description: 'Fix syntax errors' },
            { id: 'logic-fix', name: 'Logic Fix', description: 'Fix logic errors' },
          ]},
          { id: 'framework-detection', name: 'Framework Detection', nanos: [
            { id: 'laravel', name: 'Laravel', description: 'Laravel framework' },
            { id: 'react', name: 'React', description: 'React framework' },
          ]},
        ]
      },
      {
        id: 'code-conversion',
        name: 'Code Conversion',
        micros: [
          { id: 'lang-convert', name: 'Language Conversion', nanos: [
            { id: 'php-to-node', name: 'PHP to Node', description: 'Convert PHP to Node.js' },
          ]},
        ]
      },
      {
        id: 'code-repair',
        name: 'Code Repair',
        micros: [
          { id: 'security-patch', name: 'Security Patch', nanos: [
            { id: 'sql-injection', name: 'SQL Injection Fix', description: 'Fix SQL injection vulnerabilities' },
            { id: 'xss-fix', name: 'XSS Fix', description: 'Fix XSS vulnerabilities' },
          ]},
        ]
      },
    ]
  },
  {
    id: 'deployment-ai',
    name: 'Deployment AI',
    icon: Rocket,
    color: 'bg-green/20 text-green',
    description: 'Server readiness & auto deploy',
    aiTasks: ['Detect Git issues', 'Fix deploy issues', 'Auto deploy', 'Rollback decisions'],
    subs: [
      {
        id: 'server-readiness',
        name: 'Server Readiness',
        micros: [
          { id: 'build-command', name: 'Build Command Fix', nanos: [
            { id: 'npm-fix', name: 'NPM Fix', description: 'Fix NPM build commands' },
          ]},
          { id: 'env-setup', name: 'ENV Setup', nanos: [
            { id: 'env-validation', name: 'ENV Validation', description: 'Validate environment variables' },
          ]},
        ]
      },
      {
        id: 'git-handling',
        name: 'Git Handling',
        micros: [
          { id: 'connection-fix', name: 'Connection Fix', nanos: [
            { id: 'ssh-key', name: 'SSH Key Fix', description: 'Fix SSH key issues' },
          ]},
        ]
      },
      {
        id: 'build-automation',
        name: 'Build Automation',
        micros: [
          { id: 'failed-build', name: 'Failed Build Fix', nanos: [
            { id: 'auto-retry', name: 'Auto Retry', description: 'Automatic retry on failure' },
            { id: 'rollback', name: 'Rollback Decision', description: 'Auto rollback decisions' },
          ]},
        ]
      },
    ]
  },
  {
    id: 'security-ai',
    name: 'Security AI',
    icon: Shield,
    color: 'bg-red-500/20 text-red-500',
    description: 'Threat detection & access control',
    aiTasks: ['Auto security scan', 'Auto threat repair', 'Alert Super Admin'],
    subs: [
      {
        id: 'threat-detection',
        name: 'Threat Detection',
        micros: [
          { id: 'api-security', name: 'API Security', nanos: [
            { id: 'token-leak', name: 'Token Leak Detection', description: 'Detect token leaks' },
            { id: 'injection-check', name: 'Injection Check', description: 'Check for injection attacks' },
          ]},
        ]
      },
      {
        id: 'access-control',
        name: 'Access Control',
        micros: [
          { id: 'server-security', name: 'Server Security', nanos: [
            { id: 'firewall', name: 'Firewall Check', description: 'Verify firewall settings' },
          ]},
        ]
      },
      {
        id: 'data-protection',
        name: 'Data Protection',
        micros: [
          { id: 'abuse-prevention', name: 'Abuse Prevention', nanos: [
            { id: 'rate-limit', name: 'Rate Limiting', description: 'Check rate limits' },
          ]},
        ]
      },
    ]
  },
  {
    id: 'seo-leads-ai',
    name: 'SEO & Leads AI',
    icon: TrendingUp,
    color: 'bg-orange/20 text-orange',
    description: 'SEO automation & lead capture',
    aiTasks: ['Auto SEO apply', 'Auto lead form', 'WhatsApp/Email sync'],
    subs: [
      {
        id: 'seo-automation',
        name: 'SEO Automation',
        micros: [
          { id: 'google-seo', name: 'Google SEO', nanos: [
            { id: 'meta-fix', name: 'Meta Fix', description: 'Fix meta tags' },
            { id: 'schema-fix', name: 'Schema Fix', description: 'Fix schema markup' },
          ]},
          { id: 'page-speed', name: 'Page Speed', nanos: [
            { id: 'image-optimize', name: 'Image Optimize', description: 'Optimize images' },
          ]},
        ]
      },
      {
        id: 'lead-capture',
        name: 'Lead Capture',
        micros: [
          { id: 'conversion', name: 'Conversion Triggers', nanos: [
            { id: 'popup-forms', name: 'Popup Forms', description: 'Lead capture popups' },
          ]},
        ]
      },
      {
        id: 'traffic-analysis',
        name: 'Traffic Analysis',
        micros: [
          { id: 'keywords', name: 'Keyword Mapping', nanos: [
            { id: 'ranking', name: 'Ranking Check', description: 'Check keyword rankings' },
          ]},
        ]
      },
    ]
  },
  {
    id: 'payment-ai',
    name: 'Payment & Wallet AI',
    icon: Wallet,
    color: 'bg-emerald-500/20 text-emerald-500',
    description: 'Payment flow & fraud detection',
    aiTasks: ['Payment flow check', 'Failure handling', 'Fraud detection'],
    subs: [
      {
        id: 'payment-flow',
        name: 'Payment Flow',
        micros: [
          { id: 'upi', name: 'UPI', nanos: [
            { id: 'retry-logic', name: 'Retry Logic', description: 'Payment retry logic' },
          ]},
          { id: 'card', name: 'Card', nanos: [
            { id: 'fail-reason', name: 'Fail Reason', description: 'Payment failure reasons' },
          ]},
          { id: 'international', name: 'International', nanos: [
            { id: 'currency', name: 'Currency Convert', description: 'Currency conversion' },
          ]},
        ]
      },
      {
        id: 'failure-handling',
        name: 'Failure Handling',
        micros: [
          { id: 'auto-resolve', name: 'Auto Resolution', nanos: [
            { id: 'refund', name: 'Auto Refund', description: 'Automatic refunds' },
          ]},
        ]
      },
      {
        id: 'fraud-detection',
        name: 'Fraud Detection',
        micros: [
          { id: 'pattern', name: 'Pattern Detection', nanos: [
            { id: 'velocity', name: 'Velocity Check', description: 'Transaction velocity' },
          ]},
        ]
      },
    ]
  },
  {
    id: 'support-ai',
    name: 'Support AI (Internal)',
    icon: Headphones,
    color: 'bg-purple/20 text-purple',
    description: 'Ticket AI & evidence handling',
    aiTasks: ['Ticket analysis', 'Evidence handling', 'Staff assistance'],
    subs: [
      {
        id: 'ticket-ai',
        name: 'Ticket AI',
        micros: [
          { id: 'text-analysis', name: 'Text Analysis', nanos: [
            { id: 'sentiment', name: 'Sentiment', description: 'Sentiment analysis' },
          ]},
          { id: 'voice-analysis', name: 'Voice Analysis', nanos: [
            { id: 'transcription', name: 'Transcription', description: 'Voice transcription' },
          ]},
        ]
      },
      {
        id: 'evidence-handling',
        name: 'Evidence Handling',
        micros: [
          { id: 'image-analysis', name: 'Image Analysis', nanos: [
            { id: 'screenshot', name: 'Screenshot Verify', description: 'Verify screenshots' },
          ]},
        ]
      },
      {
        id: 'staff-chat',
        name: 'Staff Chat',
        micros: [
          { id: 'response-suggest', name: 'Response Suggestions', nanos: [
            { id: 'template', name: 'Templates', description: 'Response templates' },
          ]},
        ]
      },
    ]
  },
  {
    id: 'business-ai',
    name: 'Business & Decision AI',
    icon: BarChart3,
    color: 'bg-yellow-500/20 text-yellow-500',
    description: 'Revenue model & growth planning',
    aiTasks: ['Profit suggestion', 'Cost control', 'Risk alerts'],
    subs: [
      {
        id: 'revenue-model',
        name: 'Revenue Model',
        micros: [
          { id: 'subscription', name: 'Subscription', nanos: [
            { id: 'pricing', name: 'Pricing Optimize', description: 'Optimize pricing' },
          ]},
          { id: 'addons', name: 'Add-ons', nanos: [
            { id: 'upsell', name: 'Upsell', description: 'Upsell opportunities' },
          ]},
        ]
      },
      {
        id: 'pricing',
        name: 'Pricing',
        micros: [
          { id: 'usage-billing', name: 'Usage Billing', nanos: [
            { id: 'metering', name: 'Metering', description: 'Usage metering' },
          ]},
        ]
      },
      {
        id: 'growth-plan',
        name: 'Growth Plan',
        micros: [
          { id: 'risk-alert', name: 'Risk Alert', nanos: [
            { id: 'churn', name: 'Churn Risk', description: 'Churn prediction' },
          ]},
        ]
      },
    ]
  },
];

interface AiCategoriesGridProps {
  onRunTask: (categoryId: string, task: string) => void;
}

export function AiCategoriesGrid({ onRunTask }: AiCategoriesGridProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-display font-bold text-foreground">AI Module Categories</h2>
          <p className="text-sm text-muted-foreground">8 Master • 24 Sub • 48 Micro • 96 Nano</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {AI_CATEGORIES.map((category) => (
          <AiCategoryCard 
            key={category.id} 
            category={category}
            onRunTask={onRunTask}
          />
        ))}
      </div>
    </div>
  );
}
