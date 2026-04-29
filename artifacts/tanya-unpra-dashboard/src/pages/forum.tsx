import { useState, useEffect, useRef, useMemo } from "react";
import {
  useListForums,
  useCreateForum,
  useUpdateForum,
  useDeleteForum,
  useListForumMessages,
  getListForumsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { getSocket, disconnectSocket } from "@/lib/socket";
import {
  Loader2,
  Plus,
  Send,
  MessageCircle,
  Globe,
  Building2,
  GraduationCap,
  Edit,
  Trash2,
  Wifi,
  WifiOff,
  Settings,
} from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

const createSchema = z
  .object({
    name: z.string().min(2, "Min 2 karakter").max(150),
    description: z.string().max(1000).optional(),
    type: z.enum(["global", "fakultas", "prodi"]),
    fakultas: z.string().optional(),
    prodi: z.string().optional(),
    isActive: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (data.type === "fakultas" && !data.fakultas?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Wajib diisi", path: ["fakultas"] });
    }
    if (data.type === "prodi") {
      if (!data.fakultas?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Wajib diisi", path: ["fakultas"] });
      if (!data.prodi?.trim()) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Wajib diisi", path: ["prodi"] });
    }
  });

type CreateValues = z.infer<typeof createSchema>;

interface Forum {
  id: string;
  name: string;
  description?: string | null;
  type: "global" | "fakultas" | "prodi";
  fakultas?: string | null;
  prodi?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface ForumMessage {
  id: string;
  forumId: string;
  userId?: string | null;
  userName?: string | null;
  userRole?: "mahasiswa" | "dosen" | "admin" | null;
  content: string;
  createdAt: string;
}

function ForumIcon({ type }: { type: string }) {
  if (type === "global") return <Globe className="h-4 w-4" />;
  if (type === "fakultas") return <Building2 className="h-4 w-4" />;
  return <GraduationCap className="h-4 w-4" />;
}

function ForumTypeBadge({ forum }: { forum: Forum }) {
  if (forum.type === "global") return <Badge variant="secondary">Global</Badge>;
  if (forum.type === "fakultas") return <Badge variant="outline">Fakultas: {forum.fakultas}</Badge>;
  return <Badge variant="outline">Prodi: {forum.prodi}</Badge>;
}

function ChatPanel({
  forum,
  canDelete,
}: {
  forum: Forum;
  canDelete: boolean;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [messages, setMessages] = useState<ForumMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: history, isLoading } = useListForumMessages(forum.id, { limit: 50 });

  useEffect(() => {
    if (history?.messages) {
      setMessages(history.messages as ForumMessage[]);
    }
  }, [history]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    let socket: ReturnType<typeof getSocket>;
    try {
      socket = getSocket();
    } catch (err) {
      toast({ title: "Gagal terhubung", description: (err as Error).message, variant: "destructive" });
      return;
    }

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);
    const onConnectError = (err: Error) => {
      setIsConnected(false);
      toast({ title: "Koneksi gagal", description: err.message, variant: "destructive" });
    };
    const onNewMessage = (msg: ForumMessage) => {
      if (msg.forumId !== forum.id) return;
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };
    const onDeleteMessage = (payload: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== payload.id));
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("new_message", onNewMessage);
    socket.on("delete_message", onDeleteMessage);

    if (socket.connected) setIsConnected(true);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("new_message", onNewMessage);
      socket.off("delete_message", onDeleteMessage);
    };
  }, [forum.id, toast]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content) return;
    if (!forum.isActive) {
      toast({ title: "Forum nonaktif", description: "Forum ini sedang tidak aktif", variant: "destructive" });
      return;
    }
    setSending(true);
    const socket = getSocket();
    socket.emit(
      "send_message",
      { forumId: forum.id, content },
      (res: { ok: boolean; error?: string }) => {
        setSending(false);
        if (!res?.ok) {
          toast({ title: "Gagal kirim", description: res?.error ?? "Unknown error", variant: "destructive" });
        } else {
          setInput("");
        }
      },
    );
  };

  const deleteMessage = async (msgId: string) => {
    const token = localStorage.getItem("token");
    const baseUrl = import.meta.env.VITE_API_URL || "/api";
    const res = await fetch(`${baseUrl}/forums/${forum.id}/messages/${msgId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      toast({ title: "Gagal hapus pesan", variant: "destructive" });
    }
  };

  return (
    <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[500px]">
      <CardHeader className="pb-3 border-b">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ForumIcon type={forum.type} />
            <div className="min-w-0">
              <CardTitle className="text-lg truncate">{forum.name}</CardTitle>
              {forum.description && (
                <p className="text-xs text-muted-foreground truncate">{forum.description}</p>
              )}
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "secondary"} className="gap-1 shrink-0">
            {isConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isConnected ? "Live" : "Offline"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 p-4" ref={scrollRef as never}>
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat pesan…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-1">
              <MessageCircle className="h-8 w-8 mb-2 opacity-50" />
              Belum ada pesan. Jadi yang pertama!
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => {
                const isMine = msg.userId === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"} group`}
                    data-testid={`msg-${msg.id}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 ${
                        isMine ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      {!isMine && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">
                            {msg.userName ?? "User dihapus"}
                          </span>
                          {msg.userRole && (
                            <Badge variant="outline" className="text-[10px] py-0 h-4 capitalize">
                              {msg.userRole}
                            </Badge>
                          )}
                        </div>
                      )}
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                      <div className="flex items-center justify-between gap-3 mt-1">
                        <span className={`text-[10px] ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {format(new Date(msg.createdAt), "HH:mm · dd MMM", { locale: idLocale })}
                        </span>
                        {canDelete && (
                          <button
                            onClick={() => deleteMessage(msg.id)}
                            className={`text-[10px] opacity-0 group-hover:opacity-100 transition-opacity ${
                              isMine ? "text-primary-foreground/80 hover:text-primary-foreground" : "text-destructive hover:text-destructive/80"
                            }`}
                            data-testid={`btn-delete-msg-${msg.id}`}
                          >
                            Hapus
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
        <Separator />
        <div className="p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder={forum.isActive ? "Ketik pesan…" : "Forum nonaktif"}
            disabled={!forum.isActive || !isConnected || sending}
            data-testid="input-message"
          />
          <Button
            onClick={sendMessage}
            disabled={!input.trim() || !forum.isActive || !isConnected || sending}
            data-testid="btn-send-message"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ForumPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"mine" | "all">("mine");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingForum, setEditingForum] = useState<Forum | null>(null);

  const isAdmin = user?.role === "admin";
  const canEdit = user?.role === "admin" || user?.role === "dosen";

  const { data, isLoading, isError } = useListForums({
    page: 1,
    limit: 100,
    ...(isAdmin ? { scope } : {}),
  });

  const create = useCreateForum({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListForumsQueryKey() });
        setIsCreateOpen(false);
        form.reset({ name: "", description: "", type: "global", fakultas: "", prodi: "", isActive: true });
        toast({ title: "Forum berhasil dibuat" });
      },
      onError: (err: { message?: string }) => {
        toast({ title: "Gagal", description: err.message ?? "Error", variant: "destructive" });
      },
    },
  });

  const update = useUpdateForum({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListForumsQueryKey() });
        setEditingForum(null);
        toast({ title: "Forum diperbarui" });
      },
      onError: (err: { message?: string }) => {
        toast({ title: "Gagal", description: err.message ?? "Error", variant: "destructive" });
      },
    },
  });

  const remove = useDeleteForum({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListForumsQueryKey() });
        if (selectedId) setSelectedId(null);
        toast({ title: "Forum dihapus" });
      },
      onError: (err: { message?: string }) => {
        toast({ title: "Gagal", description: err.message ?? "Error", variant: "destructive" });
      },
    },
  });

  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "", type: "global", fakultas: "", prodi: "", isActive: true },
  });

  const editForm = useForm<{ name: string; description: string; isActive: boolean }>({
    defaultValues: { name: "", description: "", isActive: true },
  });

  useEffect(() => {
    if (editingForum) {
      editForm.reset({
        name: editingForum.name,
        description: editingForum.description ?? "",
        isActive: editingForum.isActive,
      });
    }
  }, [editingForum, editForm]);

  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);

  const forums = (data?.forums ?? []) as Forum[];

  const grouped = useMemo(() => {
    const g: Record<string, Forum[]> = { global: [], fakultas: [], prodi: [] };
    for (const f of forums) g[f.type]?.push(f);
    return g;
  }, [forums]);

  const selected = forums.find((f) => f.id === selectedId) ?? null;

  useEffect(() => {
    if (!selectedId && forums.length > 0) {
      setSelectedId(forums[0].id);
    }
  }, [forums, selectedId]);

  const watchType = form.watch("type");

  const onSubmit = (values: CreateValues) => {
    create.mutate({
      data: {
        name: values.name,
        description: values.description || undefined,
        type: values.type,
        fakultas: values.type === "global" ? null : values.fakultas?.trim() || null,
        prodi: values.type === "prodi" ? values.prodi?.trim() || null : null,
        isActive: values.isActive,
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forum Diskusi</h1>
          <p className="text-muted-foreground">
            Chat real-time per fakultas & program studi.
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {isAdmin && (
            <Select value={scope} onValueChange={(v) => setScope(v as "mine" | "all")}>
              <SelectTrigger className="w-[180px]" data-testid="select-scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Forum aktif saja</SelectItem>
                <SelectItem value="all">Semua forum</SelectItem>
              </SelectContent>
            </Select>
          )}
          {isAdmin && (
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button data-testid="btn-create-forum">
                  <Plus className="mr-2 h-4 w-4" /> Buat Forum
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Buat Forum Baru</DialogTitle>
                  <DialogDescription>
                    Mahasiswa & dosen otomatis bergabung sesuai fakultas/prodi mereka.
                  </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nama Forum</FormLabel>
                        <FormControl><Input {...field} data-testid="input-forum-name" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="description" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Deskripsi (opsional)</FormLabel>
                        <FormControl><Textarea {...field} rows={2} data-testid="input-forum-desc" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="type" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipe Forum</FormLabel>
                        <Select value={field.value} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger data-testid="select-forum-type"><SelectValue /></SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="global">Global (semua user)</SelectItem>
                            <SelectItem value="fakultas">Per Fakultas</SelectItem>
                            <SelectItem value="prodi">Per Program Studi</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />
                    {watchType !== "global" && (
                      <FormField control={form.control} name="fakultas" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nama Fakultas</FormLabel>
                          <FormControl><Input {...field} placeholder="Contoh: Fakultas Teknik" data-testid="input-fakultas" /></FormControl>
                          <FormDescription>Harus persis sama dengan field fakultas di profil mahasiswa/dosen.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    {watchType === "prodi" && (
                      <FormField control={form.control} name="prodi" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nama Prodi</FormLabel>
                          <FormControl><Input {...field} placeholder="Contoh: Teknik Informatika" data-testid="input-prodi" /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    )}
                    <FormField control={form.control} name="isActive" render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <div>
                          <FormLabel>Aktif</FormLabel>
                          <FormDescription>Forum nonaktif tidak bisa menerima pesan.</FormDescription>
                        </div>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-active" />
                        </FormControl>
                      </FormItem>
                    )} />
                    <DialogFooter>
                      <Button type="submit" disabled={create.isPending} data-testid="btn-submit-forum">
                        {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Buat
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <Card className="h-fit max-h-[calc(100vh-220px)] flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Daftar Forum</CardTitle>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto">
            {isLoading ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Memuat…
              </div>
            ) : isError ? (
              <div className="p-6 text-center text-destructive text-sm">Gagal memuat forum</div>
            ) : forums.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground text-sm">
                Belum ada forum yang bisa kamu akses.
              </div>
            ) : (
              <div className="space-y-1 p-2">
                {(["global", "fakultas", "prodi"] as const).map((type) =>
                  grouped[type].length > 0 ? (
                    <div key={type} className="mb-2">
                      <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        {type === "global" ? "Global" : type === "fakultas" ? "Fakultas" : "Prodi"}
                      </p>
                      {grouped[type].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setSelectedId(f.id)}
                          className={`w-full text-left rounded-md px-3 py-2 text-sm flex items-center gap-2 transition-colors group ${
                            selectedId === f.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                          }`}
                          data-testid={`forum-item-${f.id}`}
                        >
                          <ForumIcon type={f.type} />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate flex items-center gap-2">
                              {f.name}
                              {!f.isActive && <Badge variant="secondary" className="text-[10px] py-0 h-4">Off</Badge>}
                            </div>
                            {f.type !== "global" && (
                              <div className={`text-xs truncate ${selectedId === f.id ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                                {f.type === "fakultas" ? f.fakultas : `${f.fakultas} · ${f.prodi}`}
                              </div>
                            )}
                          </div>
                          {canEdit && (
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingForum(f);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  setEditingForum(f);
                                }
                              }}
                              className={`opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-background/30 ${
                                selectedId === f.id ? "text-primary-foreground" : "text-muted-foreground"
                              }`}
                              data-testid={`btn-edit-forum-${f.id}`}
                            >
                              <Settings className="h-3 w-3" />
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  ) : null,
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <ChatPanel forum={selected} canDelete={isAdmin} />
        ) : (
          <Card className="flex items-center justify-center h-[calc(100vh-220px)] min-h-[500px]">
            <div className="text-center text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>Pilih forum dari daftar untuk mulai chat.</p>
            </div>
          </Card>
        )}
      </div>

      <Dialog open={!!editingForum} onOpenChange={(open) => !open && setEditingForum(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Edit Forum</DialogTitle>
            <DialogDescription>
              {editingForum && (
                <span className="flex items-center gap-2 mt-2">
                  <ForumTypeBadge forum={editingForum} />
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          {editingForum && (
            <Form {...editForm}>
              <form
                onSubmit={editForm.handleSubmit((values) => {
                  update.mutate({
                    id: editingForum.id,
                    data: {
                      name: values.name,
                      description: values.description || null,
                      isActive: values.isActive,
                    },
                  });
                })}
                className="space-y-4"
              >
                <FormField control={editForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama</FormLabel>
                    <FormControl><Input {...field} data-testid="input-edit-name" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deskripsi</FormLabel>
                    <FormControl><Textarea {...field} rows={2} data-testid="input-edit-desc" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="isActive" render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel>Aktif</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-edit-active" />
                    </FormControl>
                  </FormItem>
                )} />
                <DialogFooter className="gap-2 sm:gap-2">
                  {isAdmin && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="destructive" data-testid="btn-delete-forum">
                          <Trash2 className="h-4 w-4 mr-1" /> Hapus
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Hapus forum ini?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Semua pesan di forum ini akan ikut terhapus permanen.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => remove.mutate({ id: editingForum.id })}
                            data-testid="btn-confirm-delete"
                          >
                            Hapus
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  <Button type="submit" disabled={update.isPending} data-testid="btn-save-edit">
                    {update.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Simpan
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
