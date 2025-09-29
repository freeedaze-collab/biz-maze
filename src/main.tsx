import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WagmiProvider } from '@/providers/WagmiProvider';
import { AuthProvider } from '@/hooks/useAuth';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <WagmiProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </WagmiProvider>
  </BrowserRouter>
);
