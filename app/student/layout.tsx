import { Provider } from '@/components/provider';

export default function StudentLayout({children}:{children:React.ReactNode}) {
  return <Provider>{children}</Provider>;
}
