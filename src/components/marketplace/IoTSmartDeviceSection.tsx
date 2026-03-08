import { SectionSlider } from './SectionSlider';
import { MarketplaceProductCard, ComingSoonCard } from './MarketplaceProductCard';
import { useProductsByCategory } from '@/hooks/useMarketplaceProducts';
import { fillToTarget } from '@/data/marketplaceProductGenerator';
import { SectionHeader } from './SectionHeader';

const TOP_5_IOT_CLONES = [
  {
    id: 'iot-clone-1', title: 'AWS IoT Core Platform Clone',
    subtitle: 'Cloud platform used to connect and manage IoT devices securely.',
    category: 'IoT', description: 'Cloud platform used to connect and manage IoT devices securely.',
    features: ['Device Management', 'Real-Time Monitoring', 'IoT Data Streams', 'Device Authentication', 'Cloud Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/aws-iotcore-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'aws-iotcore-clone-software',
  },
  {
    id: 'iot-clone-2', title: 'Google Cloud IoT Platform Clone',
    subtitle: 'IoT device management platform with cloud analytics and monitoring.',
    category: 'IoT', description: 'IoT device management platform with cloud analytics and monitoring.',
    features: ['Device Registration', 'IoT Data Monitoring', 'Cloud Integration', 'Device Analytics', 'IoT Dashboard'],
    techStack: ['Next.js', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/googlecloud-iot-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'googlecloud-iot-clone-software',
  },
  {
    id: 'iot-clone-3', title: 'Azure IoT Hub Clone',
    subtitle: 'Device connectivity and monitoring platform for large IoT deployments.',
    category: 'IoT', description: 'Device connectivity and monitoring platform for large IoT deployments.',
    features: ['Device Connectivity', 'Real-Time Monitoring', 'IoT Data Analytics', 'Device Security', 'IoT Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/azure-iothub-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'azure-iothub-clone-software',
  },
  {
    id: 'iot-clone-4', title: 'Samsung SmartThings Platform Clone',
    subtitle: 'Smart home platform for managing connected devices and automation.',
    category: 'IoT', description: 'Smart home platform for managing connected devices and automation.',
    features: ['Smart Device Control', 'Automation Rules', 'Real-Time Device Status', 'Smart Home Dashboard', 'Alerts & Notifications'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/smartthings-iot-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'smartthings-iot-clone-software',
  },
  {
    id: 'iot-clone-5', title: 'Tuya Smart IoT Platform Clone',
    subtitle: 'IoT cloud platform used to build and manage smart devices.',
    category: 'IoT', description: 'IoT cloud platform used to build and manage smart devices.',
    features: ['Device Control', 'IoT Data Analytics', 'Device Automation', 'Remote Monitoring', 'IoT Dashboard'],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    github_repo: 'https://github.com/saasvala/tuya-iot-clone-software',
    price: 5, old_price: 10, rating: 4.9, isAvailable: true, status: 'active', slug: 'tuya-iot-clone-software',
  },
];

export function IoTSmartDeviceSection({ onBuyNow }: { onBuyNow: (p: any) => void }) {
  const { products: dbProducts } = useProductsByCategory(['iot', 'smart_device', 'connected', 'sensor', 'smart_home']);
  const generatedProducts = fillToTarget(dbProducts as any, 'iot_smart', 'IoT & Smart Devices', 45);
  const displayProducts = [...TOP_5_IOT_CLONES as any[], ...generatedProducts];

  return (
    <section className="py-4">
      <SectionHeader
        icon="📡"
        title="IoT & Smart Device Platforms"
        subtitle="Device Management, Real-Time Monitoring, Cloud Integration & IoT Analytics."
        badge="IoT"
        badgeVariant="live"
        totalCount={displayProducts.length}
      />
      <SectionSlider>
        {displayProducts.map((product, i) => (
          <MarketplaceProductCard key={product.id} product={product as any} index={i} onBuyNow={onBuyNow} rank={i + 1} />
        ))}
        {displayProducts.length === 0 && <ComingSoonCard label="IoT & Smart Devices" />}
      </SectionSlider>
    </section>
  );
}
