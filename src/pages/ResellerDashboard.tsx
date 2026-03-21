import { useSearchParams } from 'react-router-dom';
import { ResellerLayout } from '@/components/reseller/ResellerLayout';
import { ResellerOverview } from '@/components/reseller/ResellerOverview';
import { KeyGeneratorPanel } from '@/components/reseller/KeyGeneratorPanel';
import { ClientsPanel } from '@/components/reseller/ClientsPanel';
import { AddBalancePanel } from '@/components/reseller/AddBalancePanel';
import { ReferralPanel } from '@/components/reseller/ReferralPanel';
import { ChangePasswordPanel } from '@/components/reseller/ChangePasswordPanel';
import { ResellerSeoPanel } from '@/components/reseller/ResellerSeoPanel';
import { ResellerAdsPanel } from '@/components/reseller/ResellerAdsPanel';
import { ResellerMarketplacePanel } from '@/components/reseller/ResellerMarketplacePanel';

export default function ResellerDashboard() {
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'overview';

  const renderContent = () => {
    switch (activeTab) {
      case 'keys':
        return <KeyGeneratorPanel />;
      case 'clients':
        return <ClientsPanel />;
      case 'seo':
        return <ResellerSeoPanel />;
      case 'ads':
        return <ResellerAdsPanel />;
      case 'marketplace':
        return <ResellerMarketplacePanel />;
      case 'wallet':
        return <AddBalancePanel />;
      case 'referral':
        return <ReferralPanel />;
      case 'password':
        return <ChangePasswordPanel />;
      default:
        return <ResellerOverview />;
    }
  };

  return (
    <ResellerLayout>
      {renderContent()}
    </ResellerLayout>
  );
}