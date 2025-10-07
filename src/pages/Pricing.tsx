// src/pages/Pricing.tsx
export default function Pricing() {
  const plansCompany = [
    { name: "Company $100", price: 100, usage: "$15 / per action" },
    { name: "Company $250", price: 250, usage: "$10 / per action" },
    { name: "Company $500", price: 500, usage: "$8 / per action" },
  ];
  const plansPersonal = [
    { name: "Personal $0", price: 0, usage: "$8 / per action" },
    { name: "Personal $30", price: 30, usage: "$5 / per action" },
    { name: "Personal $80", price: 80, usage: "$3 / per action" },
  ];

  const Bullets = () => (
    <ul className="text-sm text-muted-foreground space-y-1">
      <li>Charged actions: Transfers / Invoices / Payments / Exchange trades</li>
      <li>Free 1 month trial (usage also free)</li>
    </ul>
  );

  const Card = ({ title, items }: { title: string; items: { name: string; price: number; usage: string }[] }) => (
    <div className="rounded-2xl border p-5 space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <Bullets />
      <div className="grid md:grid-cols-3 gap-3 pt-3">
        {items.map((p) => (
          <div key={p.name} className="rounded-xl border p-4 space-y-2">
            <div className="font-semibold">{p.name}</div>
            <div className="text-2xl font-bold">${p.price}</div>
            <div className="text-sm text-muted-foreground">{p.usage}</div>
            <button className="w-full mt-2 px-3 py-2 rounded bg-primary text-primary-foreground opacity-50 cursor-not-allowed" disabled>
              Coming soon
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <h1 className="text-2xl font-bold">Pricing</h1>
      <Card title="Company" items={plansCompany} />
      <Card title="Personal" items={plansPersonal} />
    </div>
  );
}
