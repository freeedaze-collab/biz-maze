import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/hooks/useUser';
import AppLayout from '@/components/layouts/AppLayout';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

export default function Profile() {
  const { user, loading: userLoading } = useUser();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [country, setCountry] = useState('');
  const [userType, setUserType] = useState('');
  const [incomeBracket, setIncomeBracket] = useState('');
  const [entityType, setEntityType] = useState('');
  const [stateOfIncorp, setStateOfIncorp] = useState('');
  const [message, setMessage] = useState<string>('');

  const showIncomeBracket = useMemo(
    () => country === 'japan' && userType === 'individual',
    [country, userType]
  );
  const showUsCorpExtras = useMemo(
    () => country === 'usa' && userType === 'corporate',
    [country, userType]
  );

  const isFormValid = useMemo(() => {
    if (!country || !userType) return false;
    if (showIncomeBracket && !incomeBracket) return false;
    if (showUsCorpExtras && (!entityType || !stateOfIncorp)) return false;
    return true;
  }, [country, userType, showIncomeBracket, incomeBracket, showUsCorpExtras, entityType, stateOfIncorp]);

  useEffect(() => {
    if (userLoading) return;
    if (!user?.id) {
      setMessage('Failed to fetch user info.');
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      setMessage('');

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          country,
          account_type,
          income_bracket,
          entity_type,
          us_entity_type,
          state_of_incorporation,
          us_state_of_incorporation
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.warn('[Profile] load error:', error.message);
      } else if (data) {
        setCountry(data.country ?? '');
        setUserType(data.account_type ?? '');
        setIncomeBracket(data.income_bracket ?? '');
        setEntityType(data.us_entity_type ?? data.entity_type ?? '');
        setStateOfIncorp(data.us_state_of_incorporation ?? data.state_of_incorporation ?? '');
      }
      setLoading(false);
    };
    load();
  }, [userLoading, user?.id]);

  const handleSave = async () => {
    if (!isFormValid) {
      setMessage('Please fill in all required fields.');
      return;
    }

    const { data: { user: freshUser }, error: uErr } = await supabase.auth.getUser();
    if (uErr || !freshUser?.id) {
      setMessage('Could not get user. Please sign in again.');
      return;
    }

    setLoading(true);
    setMessage('');

    const normalized = {
      country: country || null,
      account_type: userType || null,
      income_bracket: showIncomeBracket ? (incomeBracket || null) : null,
      entity_type: showUsCorpExtras ? (entityType || null) : null,
      us_entity_type: showUsCorpExtras ? (entityType || null) : null,
      state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      us_state_of_incorporation: showUsCorpExtras ? (stateOfIncorp || null) : null,
      updated_at: new Date().toISOString(),
    };

    const payload = { id: freshUser.id, user_id: freshUser.id, ...normalized };

    const { error } = await supabase.from('profiles').upsert(payload, {
      onConflict: 'user_id',
    });

    if (error) {
      console.error('[Profile] save error:', error);
      setMessage('Failed to save. Please check settings/permissions.');
      setLoading(false);
    } else {
      navigate('/dashboard');
    }
  };

  if (userLoading || loading) {
    return (
      <AppLayout>
        <div className="content-container">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-48 bg-muted rounded" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!user?.id) {
    return (
      <AppLayout>
        <div className="content-container">
          <div className="card-elevated p-6 text-center">
            <p className="text-destructive">User not found. Please sign in again.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="content-container">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Profile</h1>
            <p className="text-muted-foreground mt-1">Complete your profile information to continue.</p>
          </div>

          <div className="card-elevated p-6">
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Country <span className="text-destructive">*</span>
                </label>
                <select
                  className="select-field"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                >
                  <option value="">Select country</option>
                  <option value="japan">Japan</option>
                  <option value="usa">United States</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  User Type <span className="text-destructive">*</span>
                </label>
                <select
                  className="select-field"
                  value={userType}
                  onChange={(e) => setUserType(e.target.value)}
                >
                  <option value="">Select user type</option>
                  <option value="individual">Individual</option>
                  <option value="corporate">Corporation</option>
                </select>
              </div>

              {showIncomeBracket && (
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1.5">
                    Taxable Income (Japan) <span className="text-destructive">*</span>
                  </label>
                  <select
                    className="select-field"
                    value={incomeBracket}
                    onChange={(e) => setIncomeBracket(e.target.value)}
                  >
                    <option value="">Select income bracket</option>
                    <option value="under800">Under 8M JPY</option>
                    <option value="over800">8M JPY or more</option>
                  </select>
                </div>
              )}

              {showUsCorpExtras && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      Corporation Type (US) <span className="text-destructive">*</span>
                    </label>
                    <select
                      className="select-field"
                      value={entityType}
                      onChange={(e) => setEntityType(e.target.value)}
                    >
                      <option value="">Select corporation type</option>
                      <option value="C-Corp">C Corporation</option>
                      <option value="S-Corp">S Corporation</option>
                      <option value="LLC">Limited Liability Company</option>
                      <option value="Partnership">Partnership</option>
                      <option value="PC/PA">Professional Corporation / Association</option>
                      <option value="PBC">Public Benefit Corporation</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1.5">
                      State of Incorporation <span className="text-destructive">*</span>
                    </label>
                    <select
                      className="select-field"
                      value={stateOfIncorp}
                      onChange={(e) => setStateOfIncorp(e.target.value)}
                    >
                      <option value="">Select state</option>
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

              <Button
                className="w-full"
                onClick={handleSave}
                disabled={loading || !isFormValid}
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Saving...' : 'Save Profile'}
              </Button>

              {message && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {message}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
