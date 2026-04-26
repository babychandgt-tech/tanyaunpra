import { useState } from "react";
import { useListLecturers, useCreateLecturer, useUpdateLecturer, useDeleteLecturer, getListLecturersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Search } from "lucide-react";

const schema = z.object({
  nidn: z.string().min(2).max(20),
  prodi: z.string().min(2).max(100),
  fakultas: z.string().min(2).max(100),
  jabatan: z.string().optional(),
  expertise: z.string().optional(),
});

export default function Dosen() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useListLecturers({ page, limit: 10, search: search || undefined });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateLecturer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLecturersQueryKey() });
        setIsCreateOpen(false);
        toast({ title: "Berhasil ditambahkan" });
      }
    }
  });

  const update = useUpdateLecturer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLecturersQueryKey() });
        setEditingId(null);
        toast({ title: "Berhasil diperbarui" });
      }
    }
  });

  const remove = useDeleteLecturer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLecturersQueryKey() });
        toast({ title: "Berhasil dihapus" });
      }
    }
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { nidn: "", prodi: "", fakultas: "", jabatan: "", expertise: "" },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    if (editingId) {
      update.mutate({ id: editingId, data: values });
    } else {
      create.mutate({ data: values });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Dosen</h1>
          <p className="text-muted-foreground">Kelola direktori data dosen.</p>
        </div>
        <Dialog open={isCreateOpen || !!editingId} onOpenChange={(open) => {
          if (!open) { setIsCreateOpen(false); setEditingId(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Tambah Dosen</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Tambah"} Dosen</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="nidn" render={({ field }) => (
                  <FormItem><FormLabel>NIDN</FormLabel><FormControl><Input {...field} disabled={!!editingId} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="prodi" render={({ field }) => (
                    <FormItem><FormLabel>Program Studi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="fakultas" render={({ field }) => (
                    <FormItem><FormLabel>Fakultas</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="jabatan" render={({ field }) => (
                  <FormItem><FormLabel>Jabatan</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="expertise" render={({ field }) => (
                  <FormItem><FormLabel>Keahlian</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>Simpan</Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input className="max-w-sm" placeholder="Cari NIDN atau Nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIDN</TableHead>
                <TableHead>Nama / Email</TableHead>
                <TableHead>Prodi / Fakultas</TableHead>
                <TableHead>Jabatan / Keahlian</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
              ) : data?.lecturers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Kosong</TableCell></TableRow>
              ) : (
                data?.lecturers.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.nidn}</TableCell>
                    <TableCell>
                      <div>{l.name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{l.email || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div>{l.prodi}</div>
                      <div className="text-xs text-muted-foreground">{l.fakultas}</div>
                    </TableCell>
                    <TableCell>
                      <div>{l.jabatan || '-'}</div>
                      <div className="text-xs text-muted-foreground">{l.expertise || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingId(l.id);
                          form.reset({ nidn: l.nidn, prodi: l.prodi, fakultas: l.fakultas, jabatan: l.jabatan || '', expertise: l.expertise || '' });
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirm("Hapus?") && remove.mutate({ id: l.id })}><Trash2 className="h-4 w-4" /></Button>
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
