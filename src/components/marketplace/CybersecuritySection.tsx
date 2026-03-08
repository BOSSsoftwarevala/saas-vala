import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_SECURITY_CLONES = [
  {
    id: 'sec-clone-1', title: 'Cloudflare Security Platform Clone',
    subtitle: 'Web security and performance platform protecting websites from threats.',
    category: 'Cybersecurity', description: 'Web security and performance platform protecting websites from threats.',
    features: ['Web Firewall', 'DDoS Protection', 'Traffic Monitoring', 'Threat Analytics', 'Security Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/cloudflare-security-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'cloudflare-security-clone-software',
  },
  {
    id: 'sec-clone-2', title: 'Okta Identity Platform Clone',
    subtitle: 'Identity and access management platform for secure authentication.',
    category: 'Cybersecurity', description: 'Identity and access management platform for secure authentication.',
    features: ['User Authentication', 'Single Sign-On (SSO)', 'Multi-Factor Authentication', 'Access Control', 'Identity Dashboard'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/okta-identity-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'okta-identity-clone-software',
  },
  {
    id: 'sec-clone-3', title: 'LastPass Password Manager Clone',
    subtitle: 'Secure password manager for storing and managing credentials.',
    category: 'Cybersecurity', description: 'Secure password manager for storing and managing credentials.',
    features: ['Encrypted Password Vault', 'Secure Login', 'Password Generator', 'Multi-Device Sync', 'Security Alerts'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/lastpass-password-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'lastpass-password-clone-software',
  },
  {
    id: 'sec-clone-4', title: 'NordVPN Privacy Platform Clone',
    subtitle: 'Online privacy protection platform providing secure VPN connections.',
    category: 'Cybersecurity', description: 'Online privacy protection platform providing secure VPN connections.',
    features: ['Secure VPN Connections', 'IP Masking', 'Privacy Dashboard', 'Server Locations', 'Encryption Tools'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/nordvpn-privacy-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'nordvpn-privacy-clone-software',
  },
  {
    id: 'sec-clone-5', title: 'Auth0 Authentication Platform Clone',
    subtitle: 'Authentication and authorization platform for apps and APIs.',
    category: 'Cybersecurity', description: 'Authentication and authorization platform for apps and APIs.',
    features: ['User Authentication', 'OAuth & JWT Support', 'Role-Based Access', 'Login APIs', 'Security Logs'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/auth0-authentication-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'auth0-authentication-clone-software',
  },
];

export function CybersecuritySection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['cybersecurity', 'security', 'siem', 'soc', 'privacy']);
  const generatedProducts = fillToTarget(dbProducts as any, 'cybersecurity', 'Cybersecurity', 45);
  const displayProducts = [...TOP_5_SECURITY_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🛡️"
        title="Cybersecurity & Privacy Tools"
        subtitle="Security Monitoring, Identity, VPN & Privacy platforms."
        badge="SECURE"
        badgeVariant="hot"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Cybersecurity" />}
      </SectionSlider>
    </section>
  );
}
