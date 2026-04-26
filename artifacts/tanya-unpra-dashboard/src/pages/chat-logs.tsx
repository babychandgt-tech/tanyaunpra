import { useState } from "react";
import { format } from "date-fns";
import { useListChatSessions, useGetChatSession, useGetChatStats, useFlagChatMessage, getListChatSessionsQueryKey, getGetChatSessionQueryKey, getGetChatStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquare, AlertTriangle, CheckCircle, Search, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ChatLogs() {
  const [page, setPage] = useState(1);
  const [date, setDate] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [userSearch, setUserSearch] = useState<string>("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  
  const { data: stats } = useGetChatStats();
  const { data: sessionsData, isLoading, isError } = useListChatSessions({
    page, limit: 10,
    date: date || undefined,
    search: search || undefined,
    userSearch: userSearch || undefined,
    needsReview: flaggedOnly || undefined,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chat Logs</h1>
          <p className="text-muted-foreground">Monitor and review AI interactions from the mobile app.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions Today</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.today.sessions || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.today.messages || 0} messages today</p>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-colors ${flaggedOnly ? "border-destructive bg-destructive/5" : "hover:border-destructive/50"}`}
          onClick={() => { setFlaggedOnly(f => !f); setPage(1); }}
          title="Klik untuk filter sesi yang perlu review"
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Needs Review</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${flaggedOnly ? "text-destructive" : "text-destructive"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats?.needsReview || 0}</div>
            <p className="text-xs text-muted-foreground">
              {flaggedOnly ? "Menampilkan sesi bermasalah ✓" : "Klik untuk filter sesi bermasalah"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions This Week</CardTitle>
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.week.sessions || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chat Sessions</CardTitle>
          <CardDescription>Recent chat sessions from users</CardDescription>
        </CardHeader>
        <CardContent>
          {isError && (
            <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              Gagal memuat data sesi chat. Periksa koneksi atau coba lagi.
            </div>
          )}
          <div className="flex flex-col md:flex-row flex-wrap gap-3 mb-6">
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setPage(1); }}
                className="pl-9 w-full md:max-w-xs"
              />
            </div>
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari nama/email pengguna..."
                value={userSearch}
                onChange={(e) => { setUserSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            <div className="relative flex-1 md:max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Cari device info..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="pl-9"
              />
            </div>
            {(date || search || userSearch) && (
              <Button variant="ghost" onClick={() => { setDate(""); setSearch(""); setUserSearch(""); setPage(1); }}>
                Hapus Filter
              </Button>
            )}
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Device / User</TableHead>
                  <TableHead>Messages</TableHead>
                  <TableHead>Review</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : sessionsData?.sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                      {flaggedOnly ? "Tidak ada sesi dengan pesan yang perlu review." : "No chat sessions found."}
                    </TableCell>
                  </TableRow>
                ) : (
                  sessionsData?.sessions.map((session) => (
                    <TableRow key={session.id} className={session.reviewCount > 0 ? "bg-destructive/5" : ""}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {format(new Date(session.lastMessageAt), "dd MMM yyyy, HH:mm")}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">
                            {session.userName || (session.userId ? `ID: ${session.userId.slice(0, 8)}…` : "Anonim")}
                          </span>
                          {session.userEmail && (
                            <span className="text-xs text-muted-foreground">{session.userEmail}</span>
                          )}
                          <span className="text-xs text-muted-foreground">{session.deviceInfo || "Perangkat tidak diketahui"}</span>
                        </div>
                      </TableCell>
                      <TableCell>{session.messageCount}</TableCell>
                      <TableCell>
                        {session.reviewCount > 0 ? (
                          <Badge variant="destructive" className="gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {session.reviewCount}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setSelectedSessionId(session.id)}>
                          View Details
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {sessionsData?.pagination && sessionsData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <span className="text-sm text-muted-foreground">
                Page {sessionsData.pagination.page} of {sessionsData.pagination.totalPages}
              </span>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(sessionsData.pagination.totalPages, p + 1))}
                  disabled={page === sessionsData.pagination.totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedSessionId && (
        <ChatSessionDetailModal
          sessionId={selectedSessionId}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}

function ChatSessionDetailModal({ sessionId, onClose }: { sessionId: string, onClose: () => void }) {
  const { data, isLoading } = useGetChatSession(sessionId, { query: { enabled: !!sessionId, queryKey: getGetChatSessionQueryKey(sessionId) } });
  const flagMessage = useFlagChatMessage();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleFlag = (messageId: string, currentFlag: boolean) => {
    flagMessage.mutate(
      { id: messageId, data: { needsReview: !currentFlag } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetChatSessionQueryKey(sessionId) });
          queryClient.invalidateQueries({ queryKey: getGetChatStatsQueryKey() });
          toast({
            title: !currentFlag ? "Message Flagged" : "Flag Removed",
            description: "Message status has been updated.",
          });
        }
      }
    );
  };

  return (
    <Dialog open={!!sessionId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chat Session Details</DialogTitle>
          <DialogDescription>
            {data ? `Started ${format(new Date(data.session.createdAt), "PPpp")}` : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4 space-y-4 mt-4">
          {isLoading ? (
            <div className="h-32 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            data?.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted border"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(msg.createdAt), "HH:mm")}
                  </span>
                  {msg.role === "assistant" && (
                    <>
                      {msg.answerSource && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {msg.answerSource}
                        </Badge>
                      )}
                      {msg.confidence !== null && msg.confidence !== undefined && (
                        <span className={`text-[10px] ${msg.confidence > 0.8 ? "text-green-600" : "text-yellow-600"}`}>
                          {(msg.confidence * 100).toFixed(0)}%
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-5 w-5 ${msg.needsReview ? "text-destructive hover:text-destructive" : "text-muted-foreground"}`}
                        onClick={() => handleFlag(msg.id, msg.needsReview)}
                        title={msg.needsReview ? "Remove Flag" : "Flag for Review"}
                      >
                        <AlertTriangle className="h-3 w-3" />
                      </Button>
                      {msg.needsReview && msg.reportReason && (
                        <span className="text-[10px] text-destructive italic max-w-[160px] truncate" title={msg.reportReason}>
                          "{msg.reportReason}"
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
