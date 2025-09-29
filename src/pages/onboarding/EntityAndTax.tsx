import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

type EntityType = 'personal' | 'company';

export default function EntityAndTax() {
  const [loading, setLoading] = useState(false);
  const [entity, setEntity] = useState<EntityType>('personal');
  const [companyName, setCompanyName] = useState('');
  const [taxCountry, setTaxCountry] = useState('JP');   // 例: ISO
  const [taxRegion, setTaxRegion] = useState('');       // 例: 都道府県/州、省略可
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // 既存設定があれば初期値に反映
    (async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return;

      const [{ data: prof }, { data: tax }] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('user_id', uid).maybeSingle(),
        supabase.from('user_tax_settings').select('*').eq('user_id', uid).maybeSingle(),
      ]);

      if (prof?.entity_type) setEntity(prof.entity_type as EntityType);
      if (prof?.company_name) setCompanyName(prof.company_name);
      if (tax?.tax_country) setTaxCountry(tax.tax_country);
      if (tax?.tax_region) setTaxRegion(tax.tax_region);
    })();
  }, []);

  const onSave = async () => {
    setError(null);
    setLoading(true);
    try {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) throw new Error('Not authenticated');

      // ① user_profiles を upsert（user_id ユニーク）
      {
        const payload = {
          user_id: uid,
          entity_type: entity,       // 'personal' | 'company'
          company_name: entity === 'company' ? companyName || null : null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from('user_profiles')
          .upsert(payload, { onConflict: 'user_id' });
        if (error) throw error;
      }

      // ② user_tax_settings を upsert（user_id ユニーク）
      {
        const payload = {
          user_id: uid,
          tax_country: taxCountry,
          tax_region: taxRegion || null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase
          .from('user_tax_settings')
          .upsert(payload, { onConflict: 'user_id' });
        if (error) throw error;
      }

      setDone(true);
    } catch (e: any) {
      // 重複エラーは upsert で原理的に起きないが、異なるユニーク制約でも安全にメッセージ化
      setError(e?.message ?? 'Failed to save settings.');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold">Setup complete</h1>
        <p className="text-sm text-gray-600 mt-2">
          Your entity and tax settings have been saved.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">Entity & Tax setup</h1>

      <section className="space-y-3">
        <label className="block font-medium">Entity</label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="entity"
              checked={entity === 'personal'}
              onChange={() => setEntity('personal')}
            />
            <span>Personal</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="entity"
              checked={entity === 'company'}
              onChange={() => setEntity('company')}
            />
            <span>Company</span>
          </label>
        </div>
        {entity === 'company' && (
          <div>
            <label className="block text-sm text-gray-600">Company name</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Inc."
            />
          </div>
        )}
      </section>

      <section className="space-y-3">
        <label className="block font-medium">Tax jurisdiction</label>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-gray-600">Country</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={taxCountry}
              onChange={(e) => setTaxCountry(e.target.value.toUpperCase())}
              placeholder="JP"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600">Region/Prefecture (optional)</label>
            <input
              className="w-full border rounded px-3 py-2"
              value={taxRegion}
              onChange={(e) => setTaxRegion(e.target.value)}
              placeholder="Tokyo"
            />
          </div>
        </div>
      </section>

      <button
        onClick={onSave}
        disabled={loading}
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
      >
        {loading ? 'Saving…' : 'Save'}
      </button>

      {error && <div className="text-red-600">{error}</div>}
    </div>
  );
}
