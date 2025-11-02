import dynamic from 'next/dynamic';

const DashboardView = dynamic(() => import('@/components/dashboard/DashboardView'), { ssr: false });

export default function DashboardPage(): JSX.Element {
  return <DashboardView />;
}


