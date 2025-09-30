import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WagmiProvider } from '@/providers/WagmiProvider';
import { AuthProvider } from '@/hooks/useAuth';
import { ErrorBoundary } from '@/components/ErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <WagmiProvider>
      <AuthProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </AuthProvider>
    </WagmiProvider>
  </BrowserRouter>
);
