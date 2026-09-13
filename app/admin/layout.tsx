import { Provider } from '@/components/provider';

export default function AdminLayout({children}:{children:React.ReactNode}) {
  return <Provider>{children}</Provider>;
}
