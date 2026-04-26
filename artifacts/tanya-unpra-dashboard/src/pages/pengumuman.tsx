import { useState } from "react";
import { useListAnnouncements, useCreateAnnouncement, useUpdateAnnouncement, useDeleteAnnouncement, getListAnnouncementsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Megaphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  judul: z.string().min(5).max(300),
  konten: z.string().min(10).max(10000),
  kategori: z.enum(["Akademik", "Kemahasiswaan", "Keuangan", "Umum", "Beasiswa"]),
  isActive: z.boolean().default(true),
  publishedAt: z.string().optional(),
});

export default function Pengumuman() {
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useListAnnouncements({ page, limit: 10 });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateAnnouncement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
        setIsCreateOpen(false);
        toast({ title: "Berhasil ditambahkan" });
      }
    }
  });

  const update = useUpdateAnnouncement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
        setEditingId(null);
        toast({ title: "Berhasil diperbarui" });
      }
    }
  });

  const remove = useDeleteAnnouncement({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
        toast({ title: "Berhasil dihapus" });
      }
    }
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { judul: "", konten: "", kategori: "Umum", isActive: true },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    const payload = { ...values, publishedAt: values.publishedAt || new Date().toISOString() };
    if (editingId) {
      update.mutate({ id: editingId, data: payload });
    } else {
      create.mutate({ data: payload });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pengumuman</h1>
          <p className="text-muted-foreground">Kelola pengumuman kampus.</p>
        </div>
        <Dialog open={isCreateOpen || !!editingId} onOpenChange={(open) => {
          if (!open) { setIsCreateOpen(false); setEditingId(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Buat Pengumuman</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Buat"} Pengumuman</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="judul" render={({ field }) => (
                  <FormItem><FormLabel>Judul</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="konten" render={({ field }) => (
                  <FormItem><FormLabel>Konten</FormLabel><FormControl><Textarea className="min-h-[150px]" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="kategori" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kategori</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {["Akademik", "Kemahasiswaan", "Keuangan", "Umum", "Beasiswa"].map(k => (
                            <SelectItem key={k} value={k}>{k}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="isActive" render={({ field }) => (
                    <FormItem className="flex items-center justify-between border p-3 rounded-md shadow-sm">
                      <FormLabel className="mb-0">Publikasi Aktif</FormLabel>
                      <FormControl><Switch checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>Simpan</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Judul</TableHead>
                <TableHead>Kategori</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
              ) : data?.announcements.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Kosong</TableCell></TableRow>
              ) : (
                data?.announcements.map(a => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <div className="font-medium line-clamp-1">{a.judul}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1">{a.konten}</div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{a.kategori}</Badge></TableCell>
                    <TableCell className="text-sm">{format(new Date(a.publishedAt), "dd MMM yyyy")}</TableCell>
                    <TableCell><Switch checked={a.isActive} onCheckedChange={(val) => update.mutate({ id: a.id, data: { isActive: val } })} /></TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingId(a.id);
                          form.reset({ judul: a.judul, konten: a.konten, kategori: a.kategori, isActive: a.isActive });
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirm("Hapus?") && remove.mutate({ id: a.id })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
