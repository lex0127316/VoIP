import dynamic from 'next/dynamic';

const UserManagement = dynamic(() => import('@/components/users/UserManagement'), { ssr: false });

export default function UsersPage(): JSX.Element {
  return <UserManagement />;
}


