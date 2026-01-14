// src/pages/onboarding/EntityAndTax.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/useUser';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trash2, Plus, Building2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

type Entity = {
  id: string;
  name: string;
  is_head_office: boolean;
};

export default function EntityAndTax() {
  const { user, loading: userLoading } = useUser();
  const nav = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  // Profile Data
  const [country, setCountry] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [entityType, setEntityType] = useState('');
  const [stateOfIncorp, setStateOfIncorp] = useState('');

  // Entities Data
  const [entities, setEntities] = useState<Entity[]>([]);
  const [newEntityName, setNewEntityName] = useState('');

  const showUsCorpExtras = useMemo(() => country === 'usa', [country]);

  useEffect(() => {
    if (userLoading) return;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    Promise.all([fetchProfile(), fetchEntities()]).finally(() => setLoading(false));
  }, [userLoading, user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('profiles')
      .select(`country, company_name, entity_type, us_entity_type, state_of_incorporation, us_state_of_incorporation`)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!error && data) {
      setCountry(data.country ?? '');
      setCompanyName(data.company_name ?? '');
      setEntityType(data.us_entity_type ?? data.entity_type ?? '');
      setStateOfIncorp(data.us_state_of_incorporation ?? data.state_of_incorporation ?? '');
    }
  };

  const fetchEntities = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from('entities')
      .select('*')
      .eq('user_id', user.id)
      .order('is_head_office', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching entities:', error);
    } else {
      setEntities(data || []);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setLoading(true);

    const normalized = {
      country: country || null,
      account_type: 'corporate',
      company_name: companyName || null,
      entity_type: showUsCorpExtras ? (entityType || null) : null,
      us_entity_type: showUsCorpExtras ? (entityType || null) : null,
      state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      us_state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('profiles').upsert({ id: user.id, user_id: user.id, ...normalized }, { onConflict: 'user_id' });

    if (error) {
      toast({ variant: "destructive", title: "Failed to save profile", description: error.message });
      setLoading(false);
      return;
    }

    // Auto-create default entity if none exist
    if (entities.length === 0 && companyName) {
      const { error: entErr } = await supabase.from('entities').insert({
        user_id: user.id,
        name: companyName,
        type: 'personal',
        is_head_office: true
      });
      if (!entErr) {
        await fetchEntities();
      }
    }

    toast({ title: "Setup Complete!" });
    setLoading(false);
    nav('/dashboard');
  };

  const handleAddEntity = async () => {
    if (!newEntityName.trim() || !user?.id) return;
    const { error } = await supabase.from('entities').insert({ user_id: user.id, name: newEntityName.trim(), is_head_office: false, type: 'subsidiary' });
    if (error) {
      toast({ variant: "destructive", title: "Error adding subsidiary", description: error.message });
    } else {
      setNewEntityName('');
      fetchEntities();
      toast({ title: "Subsidiary added" });
    }
  };

  const handleUpdateEntityName = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    const { error } = await supabase.from('entities').update({ name: newName.trim() }).eq('id', id);
    if (error) toast({ variant: "destructive", title: "Update failed", description: error.message });
    else fetchEntities();
  };

  const handleDeleteEntity = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    const { error } = await supabase.from('entities').delete().eq('id', id);
    if (error) toast({ variant: "destructive", title: "Delete failed", description: error.message });
    else fetchEntities();
  };

  if (userLoading || loading) return <div className="p-6 text-center">Loading...</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="space-y-2 mb-4 text-center">
        <h1 className="text-2xl font-bold">Profile Setup</h1>
        <p className="text-muted-foreground">Please provide your entity details to get started.</p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Global Settings</CardTitle>
            <CardDescription>Jurisdiction and tax settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Country</Label>
              <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">Select</option>
                <option value="japan">Japan</option>
                <option value="usa">United States</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label>Company Name</Label>
              <Input
                placeholder="e.g. Acme Corp"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>

            {showUsCorpExtras && (
              <>
                <div className="space-y-1">
                  <Label>Corporation Type (US)</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                    <option value="">Select</option>
                    <option value="C-Corp">C Corporation</option>
                    <option value="S-Corp">S Corporation</option>
                    <option value="LLC">Limited Liability Company</option>
                    <option value="Partnership">Partnership</option>
                    <option value="PC/PA">Professional Corporation / Association</option>
                    <option value="PBC">Public Benefit Corporation</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label>State of Incorporation</Label>
                  <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors cursor-pointer" value={stateOfIncorp} onChange={(e) => setStateOfIncorp(e.target.value)}>
                    <option value="">Select</option>
                    {[
                      'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
                      'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
                      'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
                      'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota',
                      'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada',
                      'New Hampshire', 'New Jersey', 'New Mexico', 'New York',
                      'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon',
                      'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
                      'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
                      'West Virginia', 'Wisconsin', 'Wyoming', 'District of Columbia'
                    ].map((state) => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Corporate Structure (Entities) */}
        <Card>
          <CardHeader>
            <CardTitle>Corporate Structure</CardTitle>
            <CardDescription>Manage Head Office and Subsidiaries.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              {entities.map(ent => (
                <div key={ent.id} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-muted">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input
                      defaultValue={ent.name}
                      onBlur={(e) => {
                        if (e.target.value !== ent.name) handleUpdateEntityName(ent.id, e.target.value)
                      }}
                      className="h-10 font-medium"
                    />
                    {ent.is_head_office && <span className="text-xs text-muted-foreground ml-1">Head Office</span>}
                  </div>
                  {!ent.is_head_office && (
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteEntity(ent.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {entities.length === 0 && <p className="text-sm text-muted-foreground italic">No entities yet. Head Office will be auto-created from 'Company Name' on save.</p>}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <Input
                placeholder="New Subsidiary Name"
                value={newEntityName}
                onChange={(e) => setNewEntityName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddEntity() }}
              />
              <Button onClick={handleAddEntity} disabled={!newEntityName}>
                <Plus className="mr-2 h-4 w-4" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={loading} className="w-full" size="lg">
          Complete Setup
        </Button>
      </div>
    </div>
  );
}
