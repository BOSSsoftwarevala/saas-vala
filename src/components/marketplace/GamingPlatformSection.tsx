import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_GAMING_CLONES = [
  {
    id: 'gaming-clone-1', title: 'Steam Game Platform Clone',
    subtitle: 'Digital distribution platform for buying, downloading, and playing games.',
    category: 'Gaming', description: 'Digital distribution platform for buying, downloading, and playing games.',
    features: ['Game Marketplace', 'Game Library', 'Achievements System', 'Multiplayer Support', 'Community Forums'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/steam-gaming-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'steam-gaming-clone-software',
  },
  {
    id: 'gaming-clone-2', title: 'Epic Games Store Clone',
    subtitle: 'Game distribution platform offering downloadable PC games.',
    category: 'Gaming', description: 'Game distribution platform offering downloadable PC games.',
    features: ['Game Store', 'User Library', 'Game Downloads', 'Game Reviews', 'Player Profiles'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/epicgames-store-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'epicgames-store-clone-software',
  },
  {
    id: 'gaming-clone-3', title: 'Xbox Game Pass Clone',
    subtitle: 'Subscription-based gaming platform with access to a large game library.',
    category: 'Gaming', description: 'Subscription-based gaming platform with access to a large game library.',
    features: ['Game Subscription', 'Game Library', 'Download & Play', 'User Profiles', 'Game Achievements'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/xbox-gamepass-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'xbox-gamepass-clone-software',
  },
  {
    id: 'gaming-clone-4', title: 'PlayStation Network Clone',
    subtitle: 'Online gaming service for purchasing games and connecting with players.',
    category: 'Gaming', description: 'Online gaming service for purchasing games and connecting with players.',
    features: ['Game Store', 'Online Multiplayer', 'Player Profiles', 'Game Library', 'Achievements System'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/playstation-network-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'playstation-network-clone-software',
  },
  {
    id: 'gaming-clone-5', title: 'Discord Gaming Community Clone',
    subtitle: 'Gaming community platform with chat, voice, and group servers.',
    category: 'Gaming', description: 'Gaming community platform with chat, voice, and group servers.',
    features: ['Voice & Text Chat', 'Gaming Communities', 'Server Channels', 'User Profiles', 'Notifications'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/discord-gaming-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'discord-gaming-clone-software',
  },
];

export function GamingPlatformSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['gaming', 'game', 'esports', 'multiplayer']);
  const generatedProducts = fillToTarget(dbProducts as any, 'gaming', 'Gaming', 45);
  const displayProducts = [...TOP_5_GAMING_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎮"
        title="Gaming Platforms & Game Distribution"
        subtitle="Game Stores, Multiplayer & Community platforms."
        badge="GAMING"
        badgeVariant="top"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Gaming" />}
      </SectionSlider>
    </section>
  );
}
