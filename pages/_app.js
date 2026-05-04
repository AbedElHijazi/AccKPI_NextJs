import { AppAuth } from '@/lib/AuthContext';

export default function App({ Component, pageProps }) {
  return (
    <AppAuth>
      <Component {...pageProps} />
    </AppAuth>
  );
}
