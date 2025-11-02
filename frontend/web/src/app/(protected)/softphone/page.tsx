import dynamic from 'next/dynamic';

const Softphone = dynamic(() => import('@/components/softphone/Softphone'), { ssr: false });

export default function SoftphonePage(): JSX.Element {
  return <Softphone />;
}


