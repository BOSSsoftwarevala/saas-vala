import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_TELEMED_CLONES = [
  {
    id: 'telemed-clone-1', title: 'Practo Telemedicine Clone',
    subtitle: 'Online healthcare platform for booking doctor appointments and consultations.',
    category: 'Healthcare', description: 'Online healthcare platform for booking doctor appointments and consultations.',
    features: ['Doctor Listings', 'Appointment Booking', 'Telemedicine Video Calls', 'Patient Dashboard', 'Medical Records'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/practo-telemedicine-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'practo-telemedicine-clone-software',
  },
  {
    id: 'telemed-clone-2', title: 'Zocdoc Medical Booking Clone',
    subtitle: 'Healthcare appointment booking platform connecting patients with doctors.',
    category: 'Healthcare', description: 'Healthcare appointment booking platform connecting patients with doctors.',
    features: ['Doctor Search', 'Appointment Scheduling', 'Patient Reviews', 'Clinic Management', 'Booking Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/zocdoc-medical-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'zocdoc-medical-clone-software',
  },
  {
    id: 'telemed-clone-3', title: 'Teladoc Telehealth Clone',
    subtitle: 'Telehealth platform providing remote medical consultations.',
    category: 'Healthcare', description: 'Telehealth platform providing remote medical consultations.',
    features: ['Video Consultations', 'Patient Profiles', 'Doctor Dashboard', 'Appointment Booking', 'Prescription System'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/teladoc-telehealth-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'teladoc-telehealth-clone-software',
  },
  {
    id: 'telemed-clone-4', title: 'HealthTap Medical Platform Clone',
    subtitle: 'Digital health platform for online doctor consultations and medical advice.',
    category: 'Healthcare', description: 'Digital health platform for online doctor consultations and medical advice.',
    features: ['Doctor Q&A', 'Telemedicine Calls', 'Health Records', 'Appointment Scheduling', 'Patient Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/healthtap-medical-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'healthtap-medical-clone-software',
  },
  {
    id: 'telemed-clone-5', title: 'Doctor On Demand Clone',
    subtitle: 'Telemedicine platform connecting patients with healthcare professionals.',
    category: 'Healthcare', description: 'Telemedicine platform connecting patients with healthcare professionals.',
    features: ['Video Doctor Visits', 'Patient Records', 'Appointment Booking', 'Prescription Management', 'Health Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/doctorondemand-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'doctorondemand-clone-software',
  },
];

export function TelemedicineSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['telemedicine', 'telehealth', 'doctor', 'patient', 'medical']);
  const generatedProducts = fillToTarget(dbProducts as any, 'telemedicine', 'Healthcare', 45);
  const displayProducts = [...TOP_5_TELEMED_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🩺"
        title="Healthcare & Telemedicine Platforms"
        subtitle="Telehealth, Doctor Booking & Patient Management."
        badge="HEALTH"
        badgeVariant="live"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Healthcare" />}
      </SectionSlider>
    </section>
  );
}
