import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_BLOCKCHAIN_CLONES = [
  {
    id: 'blockchain-clone-1', title: 'MetaMask Crypto Wallet Clone',
    subtitle: 'Crypto wallet platform for managing blockchain assets and interacting with Web3 apps.',
    category: 'Blockchain', description: 'Crypto wallet platform for managing blockchain assets and interacting with Web3 apps.',
    features: ['Crypto Wallet', 'Token Management', 'Blockchain Transactions', 'Web3 DApp Integration', 'Wallet Security'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/metamask-wallet-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'metamask-wallet-clone-software',
  },
  {
    id: 'blockchain-clone-2', title: 'OpenSea NFT Marketplace Clone',
    subtitle: 'NFT marketplace for minting, buying, and selling digital collectibles.',
    category: 'Blockchain', description: 'NFT marketplace for minting, buying, and selling digital collectibles.',
    features: ['NFT Minting', 'NFT Marketplace', 'Wallet Integration', 'NFT Auctions', 'Creator Dashboard'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/opensea-nft-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'opensea-nft-clone-software',
  },
  {
    id: 'blockchain-clone-3', title: 'Uniswap DeFi Exchange Clone',
    subtitle: 'Decentralized exchange platform for swapping cryptocurrencies.',
    category: 'Blockchain', description: 'Decentralized exchange platform for swapping cryptocurrencies.',
    features: ['Token Swapping', 'Liquidity Pools', 'Smart Contracts', 'DeFi Dashboard', 'Wallet Integration'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/uniswap-defi-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'uniswap-defi-clone-software',
  },
  {
    id: 'blockchain-clone-4', title: 'Coinbase Crypto Exchange Clone',
    subtitle: 'Cryptocurrency exchange platform for trading digital assets.',
    category: 'Blockchain', description: 'Cryptocurrency exchange platform for trading digital assets.',
    features: ['Crypto Trading', 'Wallet Integration', 'Transaction History', 'Market Charts', 'Trading Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/coinbase-exchange-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'coinbase-exchange-clone-software',
  },
  {
    id: 'blockchain-clone-5', title: 'Etherscan Blockchain Explorer Clone',
    subtitle: 'Blockchain explorer for viewing transactions, wallets, and smart contracts.',
    category: 'Blockchain', description: 'Blockchain explorer for viewing transactions, wallets, and smart contracts.',
    features: ['Transaction Explorer', 'Wallet Lookup', 'Smart Contract Data', 'Token Analytics', 'Blockchain Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/etherscan-explorer-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'etherscan-explorer-clone-software',
  },
];

export function BlockchainWeb3Section({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['blockchain', 'web3', 'crypto', 'nft', 'defi']);
  const generatedProducts = fillToTarget(dbProducts as any, 'blockchain_web3', 'Blockchain & Web3', 45);
  const displayProducts = [...TOP_5_BLOCKCHAIN_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="⛓️"
        title="Blockchain & Web3 Platforms"
        subtitle="Crypto Wallets, NFT Marketplaces, DeFi Tools & Smart Contracts."
        badge="WEB3"
        badgeVariant="hot"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Blockchain & Web3" />}
      </SectionSlider>
    </section>
  );
}
