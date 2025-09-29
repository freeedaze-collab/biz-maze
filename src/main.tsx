import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WagmiProvider } from '@/providers/WagmiProvider';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <WagmiProvider>
      <App />
    </WagmiProvider>
  </BrowserRouter>
);
