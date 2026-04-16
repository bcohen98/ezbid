import { useState, useRef, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminUsers } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, Database } from 'lucide-react';

const TRADES = [
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'flooring', label: 'Flooring' },
  { value: 'hvac', label: 'HVAC' },
  { value: 'plumbing', label: 'Plumbing' },
  { value: 'painting', label: 'Painting' },
  { value: 'general_contractor', label: 'General Contractor' },
];

export default function AdminSeeder() {
  const { data: userData } = useAdminUsers();
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState('');
  const [trade, setTrade] = useState('flooring');
  const [count, setCount] = useState(20);
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [summary, setSummary] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const selectedEmail = userData?.users?.find((u: any) => u.userId === selectedUser)?.email || '';

  const handleSeed = async () => {
    if (!selectedUser) { toast({ title: 'Select a user', variant: 'destructive' }); return; }
    setSeeding(true);
    setLogs([`⏳ Seeding ${count} ${trade} proposals for ${selectedEmail}...`]);
    setSummary('');
    try {
      const { data, error } = await supabase.functions.invoke('seed-test-proposals', {
        body: { target_user_id: selectedUser, trade, count, action: 'seed' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLogs(prev => [...prev, ...(data.log || []), '', `✅ ${data.summary}`]);
      setSummary(data.summary);
      toast({ title: 'Seed complete', description: data.summary });
    } catch (err: any) {
      setLogs(prev => [...prev, `✗ Error: ${err.message}`]);
      toast({ title: 'Seed failed', description: err.message, variant: 'destructive' });
    } finally {
      setSeeding(false);
    }
  };

  const handleClear = async () => {
    if (!selectedUser) { toast({ title: 'Select a user', variant: 'destructive' }); return; }
    setClearing(true);
    setLogs(prev => [...prev, `🗑️ Clearing seeded data for ${selectedEmail}...`]);
    setSummary('');
    try {
      const { data, error } = await supabase.functions.invoke('seed-test-proposals', {
        body: { target_user_id: selectedUser, action: 'clear' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLogs(prev => [...prev, `✅ ${data.message}`]);
      setSummary(data.message);
      toast({ title: 'Cleared', description: data.message });
    } catch (err: any) {
      setLogs(prev => [...prev, `✗ Error: ${err.message}`]);
      toast({ title: 'Clear failed', description: err.message, variant: 'destructive' });
    } finally {
      setClearing(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-4 animate-fade-in max-w-2xl">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <Database className="h-5 w-5" /> Seed Data
        </h1>
        <p className="text-sm text-muted-foreground">
          Generate realistic test proposals and line items for any user to test the intelligence system.
        </p>

        <Card>
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-sm">Target User</Label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select a user..." />
                </SelectTrigger>
                <SelectContent>
                  {(userData?.users || []).map((u: any) => (
                    <SelectItem key={u.userId} value={u.userId}>
                      {u.email} <span className="text-muted-foreground ml-1">({u.plan})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Trade Type</Label>
                <Select value={trade} onValueChange={setTrade}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRADES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">Number of Proposals</Label>
                <Input
                  type="number"
                  min={5}
                  max={50}
                  value={count}
                  onChange={e => setCount(Math.max(5, Math.min(50, parseInt(e.target.value) || 5)))}
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSeed} disabled={seeding || clearing || !selectedUser} className="flex-1">
                {seeding ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Seeding…</> : 'Seed Proposals'}
              </Button>
              <Button variant="destructive" onClick={handleClear} disabled={seeding || clearing || !selectedUser}>
                {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4 mr-1" /> Clear Seeded</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Log output */}
        {logs.length > 0 && (
          <div ref={logRef} className="bg-black text-green-400 font-mono text-xs p-4 rounded-lg h-64 overflow-y-auto">
            {logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        )}

        {summary && (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-sm px-3 py-1.5">
            {summary}
          </Badge>
        )}
      </div>
    </AdminLayout>
  );
}
