import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_HEALTHCARE_CLONES = [
  {
    id: 'health-clone-1',
    title: 'Smart Hospital Management System',
    subtitle: 'Full-stack hospital management system — real SaaS Vala product.',
    category: 'Healthcare',
    description: 'Complete smart hospital management system with patient records, appointments, billing, and doctor dashboards.',
    features: ['Patient Records', 'Appointment Scheduling', 'EMR System', 'Doctor Dashboard', 'Billing & Insurance', 'Medical History Tracking'],
    techStack: ['React', 'Node.js', 'PostgreSQL', 'JWT Auth'],
    github_repo: 'https://github.com/saasvala/smarthospital-software',
    price: 5, old_price: 10, rating: 4.9,
    isAvailable: true, status: 'active', slug: 'smarthospital-software',
  },
  {
    id: 'health-clone-2',
    title: 'Practo Hospital System Clone',
    subtitle: 'Clinic and doctor appointment platform used widely in Asia.',
    category: 'Healthcare',
    description: 'Clinic and doctor appointment platform used widely in Asia.',
    features: ['Doctor Search', 'Online Appointment Booking', 'Digital Prescriptions', 'Patient Reviews', 'Clinic Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/practo-hospital-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    isAvailable: true, status: 'active', slug: 'practo-hospital-clone-software',
  },
  {
    id: 'health-clone-3',
    title: 'Athenahealth EMR Clone',
    subtitle: 'Cloud-based electronic medical record platform.',
    category: 'Healthcare',
    description: 'Cloud-based electronic medical record platform.',
    features: ['Electronic Health Records', 'Appointment Booking', 'Doctor Notes', 'Patient Portal', 'Medical Billing'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/athenahealth-emr-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    isAvailable: true, status: 'active', slug: 'athenahealth-emr-clone-software',
  },
  {
    id: 'health-clone-4',
    title: 'Cerner Health System Clone',
    subtitle: 'Healthcare information system designed for hospitals and clinics.',
    category: 'Healthcare',
    description: 'Healthcare information system designed for hospitals and clinics.',
    features: ['Patient Management', 'Lab Results System', 'Prescription Management', 'Medical Reports', 'Hospital Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/cerner-hospital-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    isAvailable: true, status: 'active', slug: 'cerner-hospital-clone-software',
  },
  {
    id: 'health-clone-5',
    title: 'OpenMRS Hospital Clone',
    subtitle: 'Open-source medical record system used by hospitals worldwide.',
    category: 'Healthcare',
    description: 'Open-source medical record system used by hospitals worldwide.',
    features: ['Patient Database', 'Medical Records', 'Lab Test Reports', 'Treatment History', 'Hospital Admin Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/openmrs-hospital-clone-software',
    price: 5, old_price: 10, rating: 4.9,
    isAvailable: true, status: 'active', slug: 'openmrs-hospital-clone-software',
  },
];

export function HealthcareSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['healthcare', 'hospital', 'clinic', 'medical']);
  const generatedProducts = fillToTarget(dbProducts as any, 'healthcare', 'Healthcare', 45);
  const displayProducts = [...TOP_5_HEALTHCARE_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="🏥"
        title="Healthcare & Medical Services"
        subtitle="Hospital, Clinic, Pharmacy & Lab solutions."
        badge="ESSENTIAL"
        badgeVariant="live"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard
            key={product.id}
            product={product as any}
            index={i}
            onBuyNow={onBuyNow}
            rank={i + 1}
          />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="Healthcare" />}
      </SectionSlider>
    </section>
  );
}
