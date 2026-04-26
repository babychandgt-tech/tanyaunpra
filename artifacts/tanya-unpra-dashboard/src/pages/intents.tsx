import { useState } from "react";
import { useListIntents, useCreateIntent, useUpdateIntent, useDeleteIntent, getListIntentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Search, BrainCircuit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const intentSchema = z.object({
  pertanyaan: z.string().min(5, "Minimal 5 karakter").max(500),
  jawaban: z.string().min(10, "Minimal 10 karakter").max(2000),
  kategori: z.string().optional(),
  isActive: z.boolean().default(true),
});

export default function Intents() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useListIntents({ page, limit: 10, search: search || undefined });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createIntent = useCreateIntent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIntentsQueryKey() });
        setIsCreateOpen(false);
        toast({ title: "Intent berhasil ditambahkan" });
      }
    }
  });

  const updateIntent = useUpdateIntent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIntentsQueryKey() });
        setEditingId(null);
        toast({ title: "Intent berhasil diperbarui" });
      }
    }
  });

  const deleteIntent = useDeleteIntent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListIntentsQueryKey() });
        toast({ title: "Intent berhasil dihapus" });
      }
    }
  });

  const form = useForm<z.infer<typeof intentSchema>>({
    resolver: zodResolver(intentSchema),
    defaultValues: { pertanyaan: "", jawaban: "", kategori: "", isActive: true },
  });

  const onSubmit = (values: z.infer<typeof intentSchema>) => {
    if (editingId) {
      updateIntent.mutate({ id: editingId, data: values });
    } else {
      createIntent.mutate({ data: values });
    }
  };

  const handleEdit = (intent: any) => {
    setEditingId(intent.id);
    form.reset({
      pertanyaan: intent.pertanyaan,
      jawaban: intent.jawaban,
      kategori: intent.kategori || "",
      isActive: intent.isActive,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus intent ini?")) {
      deleteIntent.mutate({ id });
    }
  };

  const handleToggleActive = (id: string, currentStatus: boolean) => {
    updateIntent.mutate({ id, data: { isActive: !currentStatus } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Intents</h1>
          <p className="text-muted-foreground">Kelola basis pengetahuan (FAQ) untuk asisten AI.</p>
        </div>
        <Dialog open={isCreateOpen || !!editingId} onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingId(null);
            form.reset();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="btn-add-intent">
              <Plus className="mr-2 h-4 w-4" />
              Tambah Intent
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Intent" : "Tambah Intent Baru"}</DialogTitle>
              <DialogDescription>
                Data ini akan digunakan oleh AI untuk menjawab pertanyaan mahasiswa.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="pertanyaan"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pertanyaan / Topik</FormLabel>
                      <FormControl>
                        <Input placeholder="Contoh: Kapan jadwal KRS?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="jawaban"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jawaban</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Jawaban lengkap..." className="min-h-[100px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="kategori"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kategori</FormLabel>
                        <FormControl>
                          <Input placeholder="Contoh: Akademik" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                        <div className="space-y-0.5">
                          <FormLabel>Status Aktif</FormLabel>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={createIntent.isPending || updateIntent.isPending}>
                  {(createIntent.isPending || updateIntent.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Intent
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daftar Intent</CardTitle>
          <div className="flex w-full max-w-sm items-center space-x-2 mt-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Cari pertanyaan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pertanyaan</TableHead>
                  <TableHead>Kategori</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : data?.intents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Tidak ada intent ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.intents.map((intent) => (
                    <TableRow key={intent.id}>
                      <TableCell>
                        <div className="font-medium line-clamp-1" title={intent.pertanyaan}>{intent.pertanyaan}</div>
                        <div className="text-xs text-muted-foreground line-clamp-1 mt-1" title={intent.jawaban}>{intent.jawaban}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{intent.kategori || "Umum"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Switch 
                          checked={intent.isActive} 
                          onCheckedChange={() => handleToggleActive(intent.id, intent.isActive)} 
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(intent)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(intent.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
