import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_HEALTHCARE_CLONES = [
  {
    id: 'health-tele-clone-1', title: 'Practo Doctor Appointment Clone',
    subtitle: 'Healthcare platform for booking doctor appointments and consultations.',
    category: 'Healthcare', description: 'Healthcare platform for booking doctor appointments and consultations.',
    features: ['Doctor Listings', 'Appointment Booking', 'Patient Reviews', 'Online Consultation', 'Medical Records'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/practo-healthcare-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'practo-healthcare-clone-software',
  },
  {
    id: 'health-tele-clone-2', title: 'Zocdoc Healthcare Booking Clone',
    subtitle: 'Medical appointment booking platform connecting patients with doctors.',
    category: 'Healthcare', description: 'Medical appointment booking platform connecting patients with doctors.',
    features: ['Doctor Search', 'Appointment Booking', 'Patient Reviews', 'Insurance Integration', 'Booking Dashboard'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/zocdoc-healthcare-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'zocdoc-healthcare-clone-software',
  },
  {
    id: 'health-tele-clone-3', title: 'Teladoc Telemedicine Platform Clone',
    subtitle: 'Telemedicine platform for remote doctor consultations and prescriptions.',
    category: 'Healthcare', description: 'Telemedicine platform for remote doctor consultations and prescriptions.',
    features: ['Video Consultation', 'Doctor Dashboard', 'Patient Records', 'Prescription Management', 'Appointment Scheduling'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/teladoc-telemedicine-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'teladoc-telemedicine-clone-software',
  },
  {
    id: 'health-tele-clone-4', title: 'Doctor On Demand Telehealth Clone',
    subtitle: 'Telehealth platform offering online doctor visits and health advice.',
    category: 'Healthcare', description: 'Telehealth platform offering online doctor visits and health advice.',
    features: ['Video Doctor Visits', 'Appointment Booking', 'Medical Records', 'Secure Messaging', 'Health Reports'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/doctorondemand-telehealth-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'doctorondemand-telehealth-clone-software',
  },
  {
    id: 'health-tele-clone-5', title: 'Healthgrades Doctor Reviews Clone',
    subtitle: 'Healthcare platform providing doctor reviews, ratings, and booking.',
    category: 'Healthcare', description: 'Healthcare platform providing doctor reviews, ratings, and booking.',
    features: ['Doctor Listings', 'Patient Reviews', 'Rating System', 'Appointment Booking', 'Health Profiles'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/healthgrades-healthcare-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'healthgrades-healthcare-clone-software',
  },
];

export function HealthcareTelemedicineSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['telemedicine', 'telehealth', 'doctor', 'appointment', 'patient']);
  const generatedProducts = fillToTarget(dbProducts as any, 'healthcare_telemedicine', 'Healthcare & Telemedicine', 45);
  const displayProducts = [...TOP_5_HEALTHCARE_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🩺"
        title="Healthcare & Telemedicine Platforms"
        subtitle="Doctor Listings, Appointment Booking, Video Consultation & Medical Records."
        badge="HEALTH"
        badgeVariant="live"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Healthcare & Telemedicine" />}
      </SectionSlider>
    </section>
  );
}
