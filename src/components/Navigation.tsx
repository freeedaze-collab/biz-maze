// src/components/Navigation.tsx
import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const item = "px-4 py-2 rounded-lg hover:bg-muted transition-all duration-200 font-medium";
const active = "bg-primary text-primary-foreground hover:bg-primary/90";

export default function Navigation() {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b bg-background/95 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-4 flex items-center justify-between gap-3">
        <Link to={user ? "/dashboard" : "/"} className="text-xl font-bold text-primary hover:text-primary/80 transition-colors">
          Biz Maze
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          <NavLink to="/pricing" className={({isActive})=>`${item} ${isActive?active:""}`}>
            Pricing
          </NavLink>

          {user && (
            <>
              <NavLink to="/dashboard" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Dashboard
              </NavLink>
              <NavLink to="/wallet" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Wallets
              </NavLink>
              <NavLink to="/transactions" className={({isActive})=>`${item} ${isActive?active:""}`}>
                History
              </NavLink>
              <NavLink to="/transfer/start" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Start transfer
              </NavLink>
              <NavLink to="/invoice/new" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Create invoice
              </NavLink>
              <NavLink to="/accounting" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Accounting/Tax
              </NavLink>
              <NavLink to="/payment-gateway" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Payment Gateway
              </NavLink>
              <NavLink to="/profile" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Profile
              </NavLink>
              <button onClick={signOut} className={`${item} text-muted-foreground`}>
                Sign out
              </button>
            </>
          )}

          {!user && (
            <>
              <NavLink to="/auth/login" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Sign in
              </NavLink>
              <NavLink to="/auth/register" className={({isActive})=>`${item} ${isActive?active:""}`}>
                Create account
              </NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
