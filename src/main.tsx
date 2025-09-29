import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WagmiProvider } from '@/providers/WagmiProvider';
import "./index.css";
import { useScrollToTop } from "./hooks/useScrollToTop";

function AppWithScrollToTop() {
  useScrollToTop();
  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <WagmiProvider>
      <App />
    </WagmiProvider>
  </BrowserRouter>

);
