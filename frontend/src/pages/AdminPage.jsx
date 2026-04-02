import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminConfig, saveAdminConfig, testAcsConnection, setupAcsSource, verifyAcsSource, probeAcsFields, getActivityLog } from '../api.js';

function Section({ title, children }) {
  return (
    <div className="bg-white dark:bg-[#232323] rounded-2xl shadow-sm p-6 flex flex-col gap-4 transition-colors">
      <h2 className="text-xl font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-3">{title}</h2>
      {children}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-slate-600 dark:text-slate-300 font-semibold text-base">{label}</label>
      {hint && <p className="text-slate-400 dark:text-slate-500 text-sm">{hint}</p>}
      {children}
    </div>
  );
}

const inputCls = 'bg-white dark:bg-[#2f2f2f] border-2 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-4 py-3 text-lg focus:border-brand focus:outline-none w-full transition-colors';
const btnSecondary = 'bg-slate-100 hover:bg-slate-200 dark:bg-[#363636] dark:hover:bg-[#484848] text-slate-700 dark:text-slate-300 px-5 py-3 rounded-xl text-base font-semibold transition-colors';

export default function AdminPage() {
  const navigate = useNavigate();
  const adminUsername = JSON.parse(sessionStorage.getItem('kioskUser') || '{}').username || '';

  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [newAdminUser, setNewAdminUser] = useState('');
  const [acsTestStatus, setAcsTestStatus] = useState('');
  const [acsSetupStatus, setAcsSetupStatus] = useState('');
  const [acsProbeResults, setAcsProbeResults] = useState(null);
  const [activityLog, setActivityLog] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState('');

  useEffect(() => {
    getAdminConfig(adminUsername)
      .then(setForm)
      .catch(() => setError('Failed to load config'));
  }, [adminUsername]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const updatePreset = (index, field, value) => {
    const presets = form.durationPresets.map((p, i) => {
      if (i !== index) return field === 'default' && value ? { ...p, default: false } : p;
      return { ...p, [field]: field === 'hours' ? Number(value) : value };
    });
    set('durationPresets', presets);
  };

  const addPreset = () => set('durationPresets', [...form.durationPresets, { label: '', hours: 24, default: false }]);
  const removePreset = (index) => set('durationPresets', form.durationPresets.filter((_, i) => i !== index));

  const addAdminUser = () => {
    const u = newAdminUser.trim().toLowerCase();
    if (!u) return;
    if ((form.adminUsers || []).map((x) => x.toLowerCase()).includes(u)) return;
    set('adminUsers', [...(form.adminUsers || []), u]);
    setNewAdminUser('');
  };

  const removeAdminUser = (username) => {
    if (username.toLowerCase() === adminUsername.toLowerCase()) return;
    set('adminUsers', form.adminUsers.filter((u) => u.toLowerCase() !== username.toLowerCase()));
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      await saveAdminConfig(adminUsername, form);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (!form) return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#2a2a2a] flex items-center justify-center transition-colors">
      <p className="text-slate-500 dark:text-slate-400 text-xl">{error || 'Loading...'}</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-[#2a2a2a] p-6 transition-colors">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-lubalin font-bold text-slate-800 dark:text-white">Admin Settings</h1>
          <button
            onClick={() => navigate('/kiosk')}
            className={btnSecondary}
          >
            ← Back to Kiosk
          </button>
        </div>

        {/* Snipe-IT */}
        <Section title="Snipe-IT Connection">
          <Field label="Snipe-IT URL" hint="e.g. https://assets.yourcompany.com">
            <input type="url" className={inputCls} value={form.snipeItUrl}
              onChange={(e) => set('snipeItUrl', e.target.value.replace(/\/$/, ''))}
              placeholder="https://assets.yourcompany.com" />
          </Field>
          <Field label="API Token" hint="Snipe-IT → Your Profile → API Tokens">
            <input type="password" className={inputCls} value={form.snipeItToken}
              onChange={(e) => set('snipeItToken', e.target.value)}
              placeholder="Paste your API token" />
          </Field>
        </Section>

        {/* Camera */}
        <Section title="Camera">
          <Field label="Camera Type">
            <select className={inputCls} value={form.cameraType} onChange={(e) => set('cameraType', e.target.value)}>
              <option value="webcam">Webcam (built-in / USB)</option>
              <option value="axis">AXIS Camera (MJPEG)</option>
            </select>
          </Field>
          {form.cameraType === 'axis' && (
            <>
              <Field label="Stream URL" hint="e.g. http://192.168.1.100/mjpg/video.mjpg">
                <input type="text" className={inputCls} value={form.cameraStreamUrl}
                  onChange={(e) => set('cameraStreamUrl', e.target.value)}
                  placeholder="http://192.168.1.100/mjpg/video.mjpg" />
              </Field>
              <Field label="Snapshot URL" hint="Leave blank to use stream URL">
                <input type="text" className={inputCls} value={form.cameraSnapshotUrl}
                  onChange={(e) => set('cameraSnapshotUrl', e.target.value)}
                  placeholder="http://192.168.1.100/jpg/image.jpg" />
              </Field>
              <Field label="Camera Username (if required)">
                <input type="text" className={inputCls} value={form.cameraUsername}
                  onChange={(e) => set('cameraUsername', e.target.value)} placeholder="root" autoComplete="off" />
              </Field>
              <Field label="Camera Password (if required)">
                <input type="password" className={inputCls} value={form.cameraPassword}
                  onChange={(e) => set('cameraPassword', e.target.value)} placeholder="Password" />
              </Field>
            </>
          )}
        </Section>

        {/* Duration Presets */}
        <Section title="Checkout Duration Presets">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Mark one as default (pre-selected on the kiosk).</p>
          <div className="flex flex-col gap-3">
            {form.durationPresets.map((preset, i) => (
              <div key={i} className="flex items-center gap-3 bg-slate-50 dark:bg-[#2f2f2f] rounded-xl p-3 border border-slate-200 dark:border-slate-700">
                <input type="text"
                  className="flex-1 bg-white dark:bg-[#363636] border border-slate-200 dark:border-slate-600 dark:text-white rounded-lg px-3 py-2 text-base focus:outline-none focus:border-brand transition-colors"
                  value={preset.label} onChange={(e) => updatePreset(i, 'label', e.target.value)} placeholder="Label" />
                <input type="number" min="1"
                  className="w-24 bg-white dark:bg-[#363636] border border-slate-200 dark:border-slate-600 dark:text-white rounded-lg px-3 py-2 text-base focus:outline-none focus:border-brand transition-colors"
                  value={preset.hours} onChange={(e) => updatePreset(i, 'hours', e.target.value)} />
                <span className="text-slate-400 text-sm">hrs</span>
                <label className="flex items-center gap-1 text-sm text-slate-600 dark:text-slate-300 cursor-pointer whitespace-nowrap">
                  <input type="radio" name="defaultPreset" checked={!!preset.default}
                    onChange={() => updatePreset(i, 'default', true)} className="accent-brand" />
                  Default
                </label>
                <button onClick={() => removePreset(i)} className="text-red-400 hover:text-red-500 text-xl font-bold px-1 transition-colors">×</button>
              </div>
            ))}
          </div>
          <button onClick={addPreset}
            className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-brand text-slate-400 dark:text-slate-500 hover:text-brand py-3 rounded-xl text-lg transition-colors">
            + Add Preset
          </button>
        </Section>

        {/* AXIS Camera Station — DataSearch */}
        <Section title="AXIS Camera Station — DataSearch">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            When enabled, every checkout and return is pushed to ACS DataSearch so it's indexed alongside your camera footage.
          </p>

          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => set('acsEnabled', !form.acsEnabled)}
              className={`w-12 h-6 rounded-full transition-colors relative ${form.acsEnabled ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.acsEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
            <span className="text-slate-700 dark:text-slate-200 font-semibold text-lg">
              {form.acsEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </label>

          <Field label="ACS Server URL" hint="e.g. https://192.168.1.50:29204">
            <input type="text" className={inputCls} value={form.acsUrl}
              onChange={(e) => set('acsUrl', e.target.value.replace(/\/$/, ''))}
              placeholder="https://192.168.1.50:29204" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="ACS Username">
              <input type="text" className={inputCls} value={form.acsUsername}
                onChange={(e) => set('acsUsername', e.target.value)}
                placeholder="admin" autoComplete="off" />
            </Field>
            <Field label="ACS Password">
              <input type="password" className={inputCls} value={form.acsPassword}
                onChange={(e) => set('acsPassword', e.target.value)}
                placeholder="Password" />
            </Field>
          </div>
          <Field label="Data Source Key" hint="Unique identifier for this kiosk's data source in ACS. No spaces.">
            <input type="text" className={inputCls} value={form.acsSourceKey}
              onChange={(e) => set('acsSourceKey', e.target.value.replace(/\s/g, '-'))}
              placeholder="predator-store-room" />
          </Field>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold mb-1">One-time setup required in ACS Pro client:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open ACS Pro → <strong>Configuration</strong> → <strong>External Data Sources</strong></li>
              <li>Click <strong>Add</strong></li>
              <li>Set the <strong>Source key</strong> to match exactly what you entered above</li>
              <li>Save, then click <strong>Verify Connection</strong> below</li>
            </ol>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={async () => {
                setAcsTestStatus('Testing...');
                try {
                  await saveAdminConfig(adminUsername, form);
                  const r = await testAcsConnection(adminUsername);
                  setAcsTestStatus(`Connected — ACS Pro v${r.version}`);
                } catch (e) {
                  const err = e.response?.data;
                  setAcsTestStatus(err?.error + (err?.detail ? ` — ${JSON.stringify(err.detail)}` : '') || 'Connection failed');
                }
              }}
              className={btnSecondary}
            >
              Test Connection
            </button>
            <button
              onClick={async () => {
                setAcsSetupStatus('Checking ACS for existing data...');
                try {
                  const r = await verifyAcsSource(adminUsername);
                  const count = r.data?.TotalNumberOfRecords ?? r.data?.Results?.length ?? 0;
                  setAcsSetupStatus(`Source OK — ${count} record(s) found for key "${form.acsSourceKey}"`);
                } catch (e) {
                  const err = e.response?.data;
                  setAcsSetupStatus(`Source not found or not accessible: ${err?.detail?.Message || err?.error || e.message}`);
                }
              }}
              className={btnSecondary}
            >
              Verify Connection
            </button>
            <button
              onClick={async () => {
                setAcsProbeResults('Probing...');
                try {
                  await saveAdminConfig(adminUsername, form);
                  const r = await probeAcsFields(adminUsername);
                  setAcsProbeResults(r);
                } catch (e) {
                  setAcsProbeResults([{ label: 'error', error: e.message }]);
                }
              }}
              className={btnSecondary}
            >
              Probe Field Names
            </button>
          </div>
          {acsTestStatus && (
            <p className={`text-sm font-medium ${acsTestStatus.startsWith('Connected') ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {acsTestStatus}
            </p>
          )}
          {acsSetupStatus && (
            <p className={`text-sm font-medium ${acsSetupStatus.startsWith('Source OK') ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
              {acsSetupStatus}
            </p>
          )}
          {acsProbeResults && typeof acsProbeResults === 'string' && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{acsProbeResults}</p>
          )}
          {acsProbeResults && Array.isArray(acsProbeResults) && (
            <div className="bg-slate-900 dark:bg-[#111] rounded-xl p-4 text-xs font-mono text-slate-300 overflow-auto max-h-64">
              {acsProbeResults.map((r, i) => (
                <div key={i} className={`mb-2 ${r.status < 300 ? 'text-green-400' : 'text-red-400'}`}>
                  <span className="font-bold">[{r.label}]</span> status={r.status ?? 'err'} — {r.error || JSON.stringify(r.response)}
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Admin Users */}
        <Section title="Admin Users">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            These Snipe-IT usernames can access Admin Settings. You cannot remove yourself.
          </p>
          <div className="flex flex-col gap-2">
            {(form.adminUsers || []).map((u) => (
              <div key={u} className="flex items-center justify-between bg-slate-50 dark:bg-[#2f2f2f] border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
                <span className="text-lg font-mono text-slate-700 dark:text-slate-200">{u}</span>
                <div className="flex items-center gap-2">
                  {u.toLowerCase() === adminUsername.toLowerCase() && (
                    <span className="text-xs text-slate-700 font-semibold bg-brand-light px-2 py-0.5 rounded-full">You</span>
                  )}
                  <button
                    onClick={() => removeAdminUser(u)}
                    disabled={u.toLowerCase() === adminUsername.toLowerCase()}
                    className="text-red-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-xl font-bold px-1 transition-colors"
                  >×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input type="text"
              className="flex-1 bg-white dark:bg-[#2f2f2f] border-2 border-slate-200 dark:border-slate-700 dark:text-white rounded-xl px-4 py-3 text-lg focus:border-brand focus:outline-none transition-colors"
              placeholder="Snipe-IT username"
              value={newAdminUser}
              onChange={(e) => setNewAdminUser(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAdminUser()}
            />
            <button onClick={addAdminUser} disabled={!newAdminUser.trim()}
              className="bg-brand hover:bg-brand-dark disabled:opacity-50 text-slate-900 px-5 py-3 rounded-xl text-lg font-semibold transition-colors">
              Add
            </button>
          </div>
        </Section>

        {/* Activity Log */}
        <Section title="Recent Activity">
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Last 50 checkout and check-in events from Snipe-IT.
          </p>
          <button
            onClick={async () => {
              setActivityLoading(true);
              setActivityError('');
              try {
                const data = await getActivityLog(adminUsername);
                setActivityLog(data?.rows || []);
              } catch (e) {
                setActivityError(e.response?.data?.error || 'Failed to load activity');
              } finally {
                setActivityLoading(false);
              }
            }}
            disabled={activityLoading}
            className={`self-start ${btnSecondary} disabled:opacity-50`}
          >
            {activityLoading ? 'Loading...' : activityLog ? 'Refresh' : 'Load Activity'}
          </button>
          {activityError && (
            <p className="text-red-500 dark:text-red-400 text-sm">{activityError}</p>
          )}
          {activityLog && activityLog.length === 0 && (
            <p className="text-slate-400 dark:text-slate-500 text-sm">No activity found.</p>
          )}
          {activityLog && activityLog.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 dark:bg-[#2f2f2f] text-left text-slate-600 dark:text-slate-300">
                    <th className="px-4 py-2 font-semibold">When</th>
                    <th className="px-4 py-2 font-semibold">Action</th>
                    <th className="px-4 py-2 font-semibold">Asset</th>
                    <th className="px-4 py-2 font-semibold">User</th>
                    <th className="px-4 py-2 font-semibold">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {activityLog.map((row, i) => {
                    const isOut = row.action_type?.toLowerCase().includes('checkout');
                    const isIn = row.action_type?.toLowerCase().includes('checkin');
                    return (
                      <tr key={row.id ?? i} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#2f2f2f]/60">
                        <td className="px-4 py-2 whitespace-nowrap text-slate-500 dark:text-slate-400">
                          {row.created_at?.datetime
                            ? new Date(row.created_at.datetime).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
                            isOut ? 'bg-brand-light/40 text-slate-700 dark:bg-brand-light/20 dark:text-brand'
                            : isIn ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                            : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {isOut ? 'Check Out' : isIn ? 'Return' : row.action_type || '—'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-slate-700 dark:text-slate-200 max-w-[160px] truncate">
                          {row.item?.name || '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          {row.target?.name || '—'}
                        </td>
                        <td className="px-4 py-2 text-slate-400 dark:text-slate-500 max-w-[140px] truncate">
                          {row.note || ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Save */}
        <div className="flex flex-col gap-3 pb-6">
          {error && <p className="text-red-500 dark:text-red-400 text-lg text-center">{error}</p>}
          {saved && <p className="text-green-600 dark:text-green-400 text-lg text-center font-semibold">Settings saved!</p>}
          <button onClick={handleSave} disabled={saving}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 text-slate-900 py-5 rounded-2xl text-2xl font-bold transition-colors">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>

      </div>
    </div>
  );
}
