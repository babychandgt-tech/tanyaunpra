import { useGetDashboardSummary, useGetDashboardActivity, useGetChatStats } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, MessageSquare, GraduationCap, Activity, Loader2, TrendingUp, BrainCircuit } from "lucide-react";
import { format } from "date-fns";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Dashboard() {
  const { data: summary, isLoading: isSummaryLoading, isError: isSummaryError } = useGetDashboardSummary();
  const { data: activity, isLoading: isActivityLoading } = useGetDashboardActivity();
  const { data: chatStats, isError: isChatStatsError } = useGetChatStats();

  if (isSummaryLoading || isActivityLoading) {
    return (
      <div className="w-full h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isSummaryError) {
    return (
      <div className="rounded-md bg-destructive/10 border border-destructive/20 p-6 text-center text-destructive">
        Gagal memuat data dashboard. Periksa koneksi server dan coba lagi.
      </div>
    );
  }

  const dailyTrend = (chatStats?.dailyTrend ?? []).map((d) => ({
    date: d.date.slice(5),
    sessions: d.sessions,
  }));

  const popularTopics = chatStats?.popularTopics ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Overview informasi akademik dan aktivitas sistem.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Mahasiswa</CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-students">{summary?.counts.students || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dosen</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-lecturers">{summary?.counts.lecturers || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mata Kuliah</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-courses">{summary?.counts.courses || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sesi Chat Hari Ini</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-chats">{summary?.chatSessionsToday || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {chatStats?.today.messages || 0} pesan · {chatStats?.week.sessions || 0} sesi minggu ini
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Weekly Trend + Popular Topics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Weekly Trend Line Chart */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Tren Chat Mingguan
            </CardTitle>
            <CardDescription>Jumlah sesi percakapan per hari (7 hari terakhir)</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada data aktivitas AI</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dailyTrend} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v: number) => [v, "Sesi"]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sessions"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "hsl(var(--primary))" }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
            {chatStats && (
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{chatStats.week.sessions}</span> sesi minggu ini ·
                <span className="text-destructive font-medium">{chatStats.needsReview}</span> perlu direview
              </div>
            )}
          </CardContent>
        </Card>

        {/* Popular Topics */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5" />
              Topik Populer
            </CardTitle>
            <CardDescription>Pertanyaan paling sering minggu ini</CardDescription>
          </CardHeader>
          <CardContent>
            {popularTopics.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada data topik populer</p>
            ) : (
              <div className="space-y-3">
                {popularTopics.slice(0, 6).map((topic, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" title={topic.question}>{topic.question}</p>
                    </div>
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full whitespace-nowrap">
                      {topic.count}×
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Recent Announcements */}
        <Card className="lg:col-span-4">
          <CardHeader>
            <CardTitle>Pengumuman Terbaru</CardTitle>
            <CardDescription>
              {summary?.counts.activeAnnouncements || 0} pengumuman aktif
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary?.recentAnnouncements?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada pengumuman</p>
              ) : (
                summary?.recentAnnouncements?.map((item) => (
                  <div key={item.id} className="flex flex-col space-y-1 pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{item.judul}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.publishedAt), "dd MMM yyyy")}
                      </span>
                    </div>
                    <div className="flex items-center text-xs text-muted-foreground gap-2">
                      <span className="bg-muted px-2 py-0.5 rounded-full">{item.kategori}</span>
                      <span>Oleh: {item.authorName || "Admin"}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Agenda Mendatang</CardTitle>
            <CardDescription>Kalender akademik dalam waktu dekat</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {summary?.upcomingEvents?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Tidak ada agenda terdekat</p>
              ) : (
                summary?.upcomingEvents?.map((event) => (
                  <div key={event.id} className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                    <div className="flex flex-col items-center justify-center bg-primary/10 rounded-lg min-w-14 h-14">
                      <span className="text-xs font-medium text-primary uppercase">
                        {format(new Date(event.tanggalMulai), "MMM")}
                      </span>
                      <span className="text-lg font-bold text-primary">
                        {format(new Date(event.tanggalMulai), "dd")}
                      </span>
                    </div>
                    <div className="flex flex-col space-y-1">
                      <span className="text-sm font-medium">{event.namaEvent}</span>
                      <span className="text-xs text-muted-foreground">{event.tipe}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Aktivitas Tanya UNPRA
          </CardTitle>
          <CardDescription>Pertanyaan terbaru yang masuk ke asisten AI</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {activity?.recentChatMessages?.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada aktivitas chat</p>
            ) : (
              activity?.recentChatMessages?.map((msg) => (
                <div key={msg.id} className="flex items-start gap-4 pb-4 border-b last:border-0 last:pb-0">
                  <div className="bg-muted rounded-full p-2 mt-0.5">
                    <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex flex-col space-y-1 w-full">
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-sm font-medium line-clamp-2">"{msg.content}"</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(msg.createdAt), "HH:mm")}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      {msg.answerSource && (
                        <span className="text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                          Source: {msg.answerSource}
                        </span>
                      )}
                      {msg.confidence !== null && msg.confidence !== undefined && (
                        <span className={`px-1.5 py-0.5 rounded ${msg.confidence > 0.8 ? "text-green-600 bg-green-50" : "text-yellow-600 bg-yellow-50"}`}>
                          Conf: {(msg.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      {msg.needsReview && (
                        <span className="text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                          Needs Review
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
