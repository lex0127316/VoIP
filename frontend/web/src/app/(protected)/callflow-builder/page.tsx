import dynamic from 'next/dynamic';

const CallflowBuilder = dynamic(() => import('@/components/callflows/CallflowBuilder'), { ssr: false });

export default function CallflowBuilderPage(): JSX.Element {
  return <CallflowBuilder />;
}


