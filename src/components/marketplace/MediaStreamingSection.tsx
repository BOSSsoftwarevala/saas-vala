import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_MEDIA_CLONES = [
  {
    id: 'media-clone-1', title: 'Netflix Streaming Platform Clone',
    subtitle: 'Video streaming platform offering movies, TV shows, and personalized recommendations.',
    category: 'Media', description: 'Video streaming platform offering movies, TV shows, and personalized recommendations.',
    features: ['Video Streaming', 'Content Library', 'Watch History', 'Recommendation Engine', 'User Profiles'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/netflix-streaming-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'netflix-streaming-clone-software',
  },
  {
    id: 'media-clone-2', title: 'YouTube Video Platform Clone',
    subtitle: 'Video sharing platform allowing users to upload, watch, and comment on videos.',
    category: 'Media', description: 'Video sharing platform allowing users to upload, watch, and comment on videos.',
    features: ['Video Upload', 'Streaming Player', 'Comments & Likes', 'Channel Profiles', 'Video Analytics'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/youtube-video-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'youtube-video-clone-software',
  },
  {
    id: 'media-clone-3', title: 'Spotify Music Streaming Clone',
    subtitle: 'Music streaming platform offering playlists, albums, and artist discovery.',
    category: 'Media', description: 'Music streaming platform offering playlists, albums, and artist discovery.',
    features: ['Music Streaming', 'Playlist Builder', 'Artist Profiles', 'Listening History', 'Music Recommendations'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/spotify-music-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'spotify-music-clone-software',
  },
  {
    id: 'media-clone-4', title: 'Disney+ Streaming Clone',
    subtitle: 'Subscription-based video streaming service for movies and TV series.',
    category: 'Media', description: 'Subscription-based video streaming service for movies and TV series.',
    features: ['Subscription System', 'Video Library', 'Watchlists', 'User Profiles', 'Video Streaming Player'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/disneyplus-streaming-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'disneyplus-streaming-clone-software',
  },
  {
    id: 'media-clone-5', title: 'Twitch Live Streaming Clone',
    subtitle: 'Live streaming platform focused on gaming and creator communities.',
    category: 'Media', description: 'Live streaming platform focused on gaming and creator communities.',
    features: ['Live Video Streaming', 'Chat System', 'Creator Channels', 'Stream Analytics', 'Subscription Support'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/twitch-live-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'twitch-live-clone-software',
  },
];

export function MediaStreamingSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['media', 'streaming', 'entertainment', 'gaming', 'video']);
  const generatedProducts = fillToTarget(dbProducts as any, 'media', 'Media', 45);
  const displayProducts = [...TOP_5_MEDIA_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🎬"
        title="Media, Streaming & Entertainment Platforms"
        subtitle="Video, Music, Gaming & Live Streaming solutions."
        badge="TRENDING"
        badgeVariant="trending"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Media" />}
      </SectionSlider>
    </section>
  );
}
