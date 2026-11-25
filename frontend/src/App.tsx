import { useState } from 'react';
import { useApp } from './state/AppContext';
import { CustomerShell, type CustomerTab } from './components/AppShell';
import { RoleGate } from './screens/RoleGate';
import { Overview } from './screens/customer/Overview';
import { Rift } from './screens/customer/Rift';
import { Loans } from './screens/customer/Loans';
import { Profile } from './screens/customer/Profile';
import { MerchantApp } from './screens/merchant/MerchantApp';
import { GatewayApp } from './screens/gateway/GatewayApp';
import { Logo } from './components/AppShell';

function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="flex flex-col items-center">
        <Logo />
        <div className="mt-8 h-9 w-9 animate-spin rounded-full border-2 border-line border-t-brand" />
        <p className="mt-4 text-[11px] text-text-2">Connecting to RIFT Core…</p>
        <p className="mt-1 text-[9.5px] text-text-3">Falling back to the simulated core if unavailable</p>
      </div>
    </div>
  );
}

export default function App() {
  const { role, ready } = useApp();
  const [tab, setTab] = useState<CustomerTab>('overview');

  if (!ready) return <BootScreen />;
  if (!role) return <RoleGate />;
  if (role === 'merchant') return <MerchantApp />;
  if (role === 'gateway') return <GatewayApp />;

  return (
    <CustomerShell tab={tab} onTab={setTab}>
      {tab === 'overview' && <Overview onNavigate={setTab} />}
      {tab === 'rift' && <Rift />}
      {tab === 'loans' && <Loans />}
      {tab === 'profile' && <Profile />}
    </CustomerShell>
  );
}
