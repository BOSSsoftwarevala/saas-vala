import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_LEGAL_CLONES = [
  {
    id: 'legal-clone-1', title: 'DocuSign E-Signature Platform Clone',
    subtitle: 'Electronic signature platform for signing and managing legal documents online.',
    category: 'Legal Tech', description: 'Electronic signature platform for signing and managing legal documents online.',
    features: ['E-Signatures', 'Document Upload', 'Signature Requests', 'Audit Logs', 'Legal Document Tracking'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/docusign-esignature-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'docusign-esignature-clone-software',
  },
  {
    id: 'legal-clone-2', title: 'LegalZoom Document Platform Clone',
    subtitle: 'Online legal services platform offering legal document templates.',
    category: 'Legal Tech', description: 'Online legal services platform offering legal document templates.',
    features: ['Legal Document Templates', 'Document Generator', 'Online Filing', 'Legal Dashboard', 'Client Portal'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/legalzoom-document-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'legalzoom-document-clone-software',
  },
  {
    id: 'legal-clone-3', title: 'Clio Legal Case Management Clone',
    subtitle: 'Legal practice management platform used by law firms.',
    category: 'Legal Tech', description: 'Legal practice management platform used by law firms.',
    features: ['Case Management', 'Client Portal', 'Document Storage', 'Legal Billing', 'Legal Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/clio-legal-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'clio-legal-clone-software',
  },
  {
    id: 'legal-clone-4', title: 'HelloSign E-Signature Clone',
    subtitle: 'Electronic signature platform used to sign contracts and agreements.',
    category: 'Legal Tech', description: 'Electronic signature platform used to sign contracts and agreements.',
    features: ['E-Signatures', 'Contract Upload', 'Signature Workflow', 'Document Tracking', 'Secure Signing'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/hellosign-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'hellosign-clone-software',
  },
  {
    id: 'legal-clone-5', title: 'Rocket Lawyer Platform Clone',
    subtitle: 'Legal document and consultation platform for individuals and businesses.',
    category: 'Legal Tech', description: 'Legal document and consultation platform for individuals and businesses.',
    features: ['Legal Document Builder', 'Contract Templates', 'E-Signatures', 'Legal Dashboard', 'Client Portal'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/rocketlawyer-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'rocketlawyer-clone-software',
  },
];

export function LegalTechSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['legal', 'law', 'contract', 'esignature', 'document']);
  const generatedProducts = fillToTarget(dbProducts as any, 'legal_tech', 'Legal Tech', 45);
  const displayProducts = [...TOP_5_LEGAL_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="⚖️"
        title="Legal Tech & Document Automation"
        subtitle="E-Signatures, Case Management, Contract Templates & Legal Automation."
        badge="LEGAL"
        badgeVariant="top"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Legal Tech" />}
      </SectionSlider>
    </section>
  );
}
