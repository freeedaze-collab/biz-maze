import { NavLink } from 'react-router-dom';
import { useState } from 'react';

function cx(...cls: Array<string | false | null | undefined>) {
  return cls.filter(Boolean).join(' ');
}

/**
 * Sidebar (full)
 * - 主要ルートをセクションごとに整理
 * - /transaction-history は使わず、実データ版 /transactions に統一
 * - アクティブ時のスタイル明確化
 */
export default function Sidebar() {
  const [open, setOpen] = useState(true);

  const linkBase =
    'block px-3 py-2 rounded text-sm transition-colors';
  const linkActive =
    'bg-gray-900 text-white';
  const linkIdle =
    'text-gray-700 hover:bg-gray-100';

  return (
    <aside
      className={cx(
        'border-r min-h-screen flex flex-col',
        open ? 'w-64' : 'w-16'
      )}
    >
      {/* Header / Brand */}
      <div className="h-14 flex items-center justify-between px-3 border-b">
        <div className="font-bold truncate">{open ? 'BizMaze' : 'BM'}</div>
        <button
          className="text-xs px-2 py-1 rounded border hover:bg-gray-50"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle sidebar"
        >
          {open ? '‹' : '›'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Overview */}
        <div>
          {open && <div className="text-[11px] font-semibold text-gray-500 mb-2">OVERVIEW</div>}
          <NavLink
            to="/"
            className={({ isActive }) =>
              cx(linkBase, isActive ? linkActive : linkIdle)
            }
          >
            {open ? 'Dashboard' : 'D'}
          </NavLink>
        </div>

        {/* Finance */}
        <div>
          {open && <div className="text-[11px] font-semibold text-gray-500 mb-2">FINANCE</div>}
          <div className="space-y-1">
            <NavLink
              to="/accounting"
              className={({ isActive }) =>
                cx(linkBase, isActive ? linkActive : linkIdle)
              }
            >
              {open ? 'Accounting / Tax' : 'A'}
            </NavLink>
            <NavLink
              to="/transactions"
              className={({ isActive }) =>
                cx(linkBase, isActive ? linkActive : linkIdle)
              }
            >
              {open ? 'Transaction history' : 'T'}
            </NavLink>
          </div>
        </div>

        {/* Wallet */}
        <div>
          {open && <div className="text-[11px] font-semibold text-gray-500 mb-2">WALLET</div>}
          <NavLink
            to="/transfer"
            className={({ isActive }) =>
              cx(linkBase, isActive ? linkActive : linkIdle)
            }
          >
            {open ? 'Transfer' : 'Tr'}
          </NavLink>
        </div>

        {/* Account / Plans */}
        <div>
          {open && <div className="text-[11px] font-semibold text-gray-500 mb-2">ACCOUNT</div>}
          <div className="space-y-1">
            <NavLink
              to="/pricing"
              className={({ isActive }) =>
                cx(linkBase, isActive ? linkActive : linkIdle)
              }
            >
              {open ? 'Pricing (Personal / Company)' : 'P'}
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                cx(linkBase, isActive ? linkActive : linkIdle)
              }
            >
              {open ? 'Settings' : 'S'}
            </NavLink>
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-3 border-t text-[11px] text-gray-500">
        {open ? (
          <div>v1 • Polygon-first</div>
        ) : (
          <div className="text-center">v1</div>
        )}
      </div>
    </aside>
  );
}
