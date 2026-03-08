import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_AI_CLONES = [
  {
    id: 'ai-clone-1', title: 'ChatGPT AI Platform Clone',
    subtitle: 'AI conversational platform for chat, automation, and intelligent assistants.',
    category: 'AI Tools', description: 'AI conversational platform for chat, automation, and intelligent assistants.',
    features: ['AI Chat Interface', 'Prompt System', 'Conversation History', 'API Integration', 'AI Assistant Tools'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/chatgpt-ai-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'chatgpt-ai-clone-software',
  },
  {
    id: 'ai-clone-2', title: 'Midjourney Image Generator Clone',
    subtitle: 'AI image generation platform that creates images from text prompts.',
    category: 'AI Tools', description: 'AI image generation platform that creates images from text prompts.',
    features: ['Text-to-Image Generation', 'Prompt Editor', 'Image Gallery', 'AI Model Integration', 'Download & Sharing'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/midjourney-image-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'midjourney-image-clone-software',
  },
  {
    id: 'ai-clone-3', title: 'Jasper AI Writer Clone',
    subtitle: 'AI writing assistant platform for marketing and content creation.',
    category: 'AI Tools', description: 'AI writing assistant platform for marketing and content creation.',
    features: ['AI Content Generation', 'Templates Library', 'Document Editor', 'Tone Customization', 'Export Tools'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/jasper-ai-writer-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'jasper-ai-writer-clone-software',
  },
  {
    id: 'ai-clone-4', title: 'Zapier Automation Clone',
    subtitle: 'Workflow automation platform connecting apps and automating tasks.',
    category: 'AI Tools', description: 'Workflow automation platform connecting apps and automating tasks.',
    features: ['Workflow Builder', 'Trigger & Actions', 'App Integrations', 'Task Automation', 'Automation Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/zapier-automation-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'zapier-automation-clone-software',
  },
  {
    id: 'ai-clone-5', title: 'Notion AI Workspace Clone',
    subtitle: 'AI-powered productivity workspace for documents, tasks, and collaboration.',
    category: 'AI Tools', description: 'AI-powered productivity workspace for documents, tasks, and collaboration.',
    features: ['AI Document Editor', 'Knowledge Base', 'Task Management', 'AI Writing Assistant', 'Workspace Collaboration'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/notion-ai-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'notion-ai-clone-software',
  },
];

export function AiAutomationSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['ai', 'automation', 'ml', 'artificial_intelligence', 'nlp']);
  const generatedProducts = fillToTarget(dbProducts as any, 'ai_automation', 'AI Tools', 45);
  const displayProducts = [...TOP_5_AI_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🤖"
        title="AI & Automation Tools"
        subtitle="AI Agents, Chatbots, Image Gen & Workflow Automation."
        badge="AI"
        badgeVariant="hot"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="AI Tools" />}
      </SectionSlider>
    </section>
  );
}
