import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useAdminAnalytics, useAdminVisitorAnalytics } from '@/hooks/useAdminData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { AlertTriangle, Eye, Bug, Wifi, Users, TrendingUp, FileText, ArrowDownRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const RANGE_OPTIONS = [
  { value: 'hour', label: 'Past Hour' },
  { value: 'day', label: 'Past Day' },
  { value: 'week', label: 'Past Week' },
  { value: 'month', label: 'Past Month' },
  { value: 'year', label: 'Past Year' },
] as const;

const VISITOR_RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
  { value: 'all', label: 'All Time' },
] as const;

function formatTick(value: string, range: string) {
  if (range === 'hour') return value.slice(11, 16);
  if (range === 'day') return value.slice(11, 13) + ':00';
  if (range === 'year') return value.slice(0, 7);
  return value.slice(5);
}

export default function AdminAnalytics() {
  const [range, setRange] = useState('month');
  const [visitorRange, setVisitorRange] = useState('30');
  const [activeTab, setActiveTab] = useState('site');

  const { data, isLoading } = useAdminAnalytics(range);
  const { data: visitorData, isLoading: visitorLoading } = useAdminVisitorAnalytics(visitorRange);

  const rangeLabel = data?.rangeLabel || '30d';

  return (
    <AdminLayout>
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-lg font-semibold">Site Analytics</h1>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="site">Site Health</TabsTrigger>
            <TabsTrigger value="visitors">Visitor Analytics</TabsTrigger>
          </TabsList>

          {/* ──── Visitor Analytics Tab ──── */}
          <TabsContent value="visitors" className="space-y-6 mt-4">
            <div className="flex justify-end">
              <Select value={visitorRange} onValueChange={setVisitorRange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISITOR_RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {visitorLoading ? (
              <p className="text-sm text-muted-foreground">Loading visitor analytics...</p>
            ) : visitorData ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard
                    icon={<Users className="h-4 w-4" />}
                    label="Unique Visitors (All Time)"
                    value={visitorData.summary?.uniqueVisitorsAllTime ?? 0}
                  />
                  <SummaryCard
                    icon={<Eye className="h-4 w-4" />}
                    label="Unique Visitors (30d)"
                    value={visitorData.summary?.uniqueVisitors30d ?? 0}
                  />
                  <SummaryCard
                    icon={<TrendingUp className="h-4 w-4" />}
                    label="Total Visits (30d)"
                    value={visitorData.summary?.totalVisits30d ?? 0}
                  />
                  <SummaryCard
                    icon={<FileText className="h-4 w-4" />}
                    label="Guest Proposals (30d)"
                    value={visitorData.summary?.guestProposals30d ?? 0}
                  />
                </div>

                {/* Time Series Chart */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      Visitors — {VISITOR_RANGE_OPTIONS.find(o => o.value === visitorRange)?.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={visitorData.dailyData || []}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(v) => v.slice(5)}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip
                            contentStyle={{
                              background: 'hsl(var(--popover))',
                              border: '1px solid hsl(var(--border))',
                              borderRadius: 8,
                              fontSize: 12,
                            }}
                          />
                          <Legend />
                          <Area
                            type="monotone"
                            dataKey="totalVisits"
                            name="Total Visits"
                            stroke="hsl(var(--primary))"
                            fill="hsl(var(--primary) / 0.15)"
                            strokeWidth={2}
                          />
                          <Area
                            type="monotone"
                            dataKey="uniqueVisitors"
                            name="Unique Visitors"
                            stroke="hsl(var(--muted-foreground))"
                            fill="hsl(var(--muted-foreground) / 0.1)"
                            strokeWidth={1.5}
                            strokeDasharray="4 2"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Guest vs Logged-in & New vs Returning */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">Guest vs Logged-in Visits</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={visitorData.dailyData || []}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                            <Legend />
                            <Bar dataKey="guestVisits" name="Guest" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} stackId="a" />
                            <Bar dataKey="loggedInVisits" name="Logged In" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} stackId="a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">New vs Returning Visitors</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-48 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={visitorData.dailyData || []}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 10 }} />
                            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                            <Tooltip contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                            <Legend />
                            <Bar dataKey="newVisitors" name="New" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} stackId="a" />
                            <Bar dataKey="returningVisitors" name="Returning" fill="hsl(var(--muted-foreground))" radius={[2, 2, 0, 0]} stackId="a" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* User Funnel */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                      User Funnel — {VISITOR_RANGE_OPTIONS.find(o => o.value === visitorRange)?.label}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FunnelChart funnel={visitorData.funnel} />
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>

          {/* ──── Site Health Tab (existing) ──── */}
          <TabsContent value="site" className="space-y-6 mt-4">
            <div className="flex justify-end">
              <Select value={range} onValueChange={setRange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RANGE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading analytics...</p>
            ) : data ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <SummaryCard icon={<Eye className="h-4 w-4" />} label={`Page Views (${rangeLabel})`} value={data.totalViews30d} />
                  <SummaryCard icon={<Bug className="h-4 w-4" />} label={`Errors (${rangeLabel})`} value={data.totalErrors30d} />
                  <SummaryCard icon={<Wifi className="h-4 w-4" />} label="Zero-Traffic Periods" value={data.downtimeDays?.length || 0} />
                  <SummaryCard icon={<AlertTriangle className="h-4 w-4" />} label="Top Page" value={data.topPages?.[0]?.path || '—'} small />
                </div>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Site Visits — {RANGE_OPTIONS.find((o) => o.value === range)?.label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data.dailyVisits}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tickFormatter={(v) => formatTick(v, range)} tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip labelFormatter={(v) => formatTick(v as string, range)} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                          <Area type="monotone" dataKey="pageViews" name="Page Views" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.15)" strokeWidth={2} />
                          <Area type="monotone" dataKey="visitors" name="Unique Visitors" stroke="hsl(var(--muted-foreground))" fill="hsl(var(--muted-foreground) / 0.1)" strokeWidth={1.5} strokeDasharray="4 2" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Client Errors — {RANGE_OPTIONS.find((o) => o.value === range)?.label}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="h-48 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.dailyErrors}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="date" tickFormatter={(v) => formatTick(v, range)} tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                          <Tooltip labelFormatter={(v) => formatTick(v as string, range)} contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
                          <Bar dataKey="errors" name="Errors" fill="hsl(0 72% 51%)" radius={[3, 3, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Zero-Traffic Periods</CardTitle></CardHeader>
                    <CardContent>
                      {data.downtimeDays?.length > 0 ? (
                        <ul className="space-y-1">
                          {data.downtimeDays.map((d: string) => (
                            <li key={d} className="text-sm flex items-center gap-2 text-destructive"><AlertTriangle className="h-3 w-3" />{d}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-muted-foreground">No downtime detected ✓</p>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Top Pages</CardTitle></CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {(data.topPages || []).map((p: { path: string; count: number }) => (
                          <div key={p.path} className="flex items-center justify-between text-sm">
                            <span className="truncate max-w-[200px]">{p.path}</span>
                            <span className="font-medium tabular-nums">{p.count}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Recent Errors</CardTitle></CardHeader>
                  <CardContent>
                    {data.recentErrors?.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-2 pr-4 font-medium">Time</th>
                              <th className="pb-2 pr-4 font-medium">Path</th>
                              <th className="pb-2 font-medium">Message</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.recentErrors.map((e: { timestamp: string; path: string; message: string }, i: number) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="py-1.5 pr-4 whitespace-nowrap text-muted-foreground">{new Date(e.timestamp).toLocaleString()}</td>
                                <td className="py-1.5 pr-4 whitespace-nowrap">{e.path}</td>
                                <td className="py-1.5 truncate max-w-[400px]">{e.message}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No recent errors ✓</p>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function SummaryCard({ icon, label, value, small }: { icon: React.ReactNode; label: string; value: string | number; small?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">{icon}{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={small ? 'text-sm font-semibold truncate' : 'text-2xl font-semibold'}>{value}</p>
      </CardContent>
    </Card>
  );
}

function FunnelChart({ funnel }: { funnel: { uniqueVisitors: number; startedGuestProposal: number; completedGuestProposal: number; createdAccount: number; upgradedToPaid: number } | undefined }) {
  if (!funnel) return <p className="text-sm text-muted-foreground">No data yet</p>;

  const steps = [
    { label: 'Unique Visitors', value: funnel.uniqueVisitors },
    { label: 'Started Guest Proposal', value: funnel.startedGuestProposal },
    { label: 'Completed Guest Proposal', value: funnel.completedGuestProposal },
    { label: 'Created Account', value: funnel.createdAccount },
    { label: 'Upgraded to Paid', value: funnel.upgradedToPaid },
  ];

  const maxValue = Math.max(steps[0].value, 1);

  return (
    <div className="space-y-3">
      {steps.map((step, i) => {
        const pct = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
        const dropoff = i > 0 && steps[i - 1].value > 0
          ? Math.round(((steps[i - 1].value - step.value) / steps[i - 1].value) * 100)
          : null;

        return (
          <div key={step.label} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium">{step.label}</span>
                {dropoff !== null && dropoff > 0 && (
                  <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                    <ArrowDownRight className="h-3 w-3" />
                    {dropoff}% drop
                  </span>
                )}
              </div>
              <span className="font-semibold tabular-nums">{step.value.toLocaleString()}</span>
            </div>
            <div className="h-6 bg-muted rounded-sm overflow-hidden">
              <div
                className="h-full bg-foreground/80 rounded-sm transition-all duration-500"
                style={{ width: `${Math.max(pct, 1)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
