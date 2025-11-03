// src/pages/Dashboard.tsx
import { Link } from "react-router-dom";

export default function Dashboard() {
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="text-sm text-muted-foreground">
          Welcome back
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Money</h2>
          <div className="flex flex-col gap-2">
            {/* ✅ Send money */}
            <Link
              to="/send-money"
              className="px-3 py-2 rounded bg-blue-600 text-white text-center"
            >
              Send money
            </Link>
            {/* ✅ Create invoice */}
            <Link
              to="/create-invoice"
              className="px-3 py-2 rounded border text-center"
            >
              Create invoice
            </Link>
          </div>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Records</h2>
          <div className="flex flex-col gap-2">
            <Link to="/transactions" className="px-3 py-2 rounded border text-center">
              Transaction History
            </Link>
            <Link to="/accounting" className="px-3 py-2 rounded border text-center">
              Accounting / Tax
            </Link>
          </div>
        </div>

        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">Account</h2>
          <div className="flex flex-col gap-2">
            <Link to="/profile" className="px-3 py-2 rounded border text-center">
              Profile
            </Link>
            <Link to="/pricing" className="px-3 py-2 rounded border text-center">
              Upgrade Plan
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
