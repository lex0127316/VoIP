import dynamic from 'next/dynamic';

const AnalyticsView = dynamic(() => import('@/components/analytics/AnalyticsView'), { ssr: false });

export default function AnalyticsPage(): JSX.Element {
  return <AnalyticsView />;
}


