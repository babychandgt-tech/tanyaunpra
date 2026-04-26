import { useState } from "react";
import { useListCourses, useCreateCourse, useUpdateCourse, useDeleteCourse, getListCoursesQueryKey, useListLecturers } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Search, BookOpen } from "lucide-react";

const schema = z.object({
  kode: z.string().min(2).max(20),
  nama: z.string().min(3).max(200),
  sks: z.coerce.number().min(1).max(6),
  semester: z.coerce.number().min(1).max(14),
  prodi: z.string().min(2).max(100),
  deskripsi: z.string().optional(),
  lecturerId: z.string().optional(),
});

export default function Matkul() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading, isError } = useListCourses({ page, limit: 10, search: search || undefined });
  const { data: lecturers } = useListLecturers({ limit: 100 });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        setIsCreateOpen(false);
        toast({ title: "Berhasil ditambahkan" });
      }
    }
  });

  const update = useUpdateCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        setEditingId(null);
        toast({ title: "Berhasil diperbarui" });
      }
    }
  });

  const remove = useDeleteCourse({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListCoursesQueryKey() });
        toast({ title: "Berhasil dihapus" });
      }
    }
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { kode: "", nama: "", sks: 3, semester: 1, prodi: "", deskripsi: "", lecturerId: "" },
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
          <h1 className="text-3xl font-bold tracking-tight">Mata Kuliah</h1>
          <p className="text-muted-foreground">Kelola daftar mata kuliah universitas.</p>
        </div>
        <Dialog open={isCreateOpen || !!editingId} onOpenChange={(open) => {
          if (!open) { setIsCreateOpen(false); setEditingId(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Tambah Matkul</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Tambah"} Mata Kuliah</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="kode" render={({ field }) => (
                    <FormItem className="col-span-1"><FormLabel>Kode</FormLabel><FormControl><Input {...field} disabled={!!editingId} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="nama" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Nama Matkul</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="sks" render={({ field }) => (
                    <FormItem><FormLabel>SKS</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="semester" render={({ field }) => (
                    <FormItem><FormLabel>Semester</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="prodi" render={({ field }) => (
                  <FormItem><FormLabel>Program Studi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="lecturerId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dosen Pengampu (Opsional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Pilih Dosen" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {lecturers?.lecturers.map(l => (
                          <SelectItem key={l.id} value={l.id}>{l.name || l.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="deskripsi" render={({ field }) => (
                  <FormItem><FormLabel>Deskripsi (Opsional)</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
            <Input className="max-w-sm" placeholder="Cari Kode atau Nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode / Matkul</TableHead>
                <TableHead>SKS / Smt</TableHead>
                <TableHead>Program Studi</TableHead>
                <TableHead>Dosen</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Gagal memuat data mata kuliah. Coba refresh halaman.</TableCell></TableRow>
              ) : data?.courses.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Kosong</TableCell></TableRow>
              ) : (
                data?.courses.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="font-medium text-primary">{c.kode}</div>
                      <div className="text-sm font-medium">{c.nama}</div>
                    </TableCell>
                    <TableCell>
                      <div>{c.sks} SKS</div>
                      <div className="text-xs text-muted-foreground">Smt {c.semester}</div>
                    </TableCell>
                    <TableCell>{c.prodi}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.lecturerName || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingId(c.id);
                          form.reset({ kode: c.kode, nama: c.nama, sks: c.sks, semester: c.semester, prodi: c.prodi, deskripsi: c.deskripsi || '', lecturerId: c.lecturerId || '' });
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirm("Hapus?") && remove.mutate({ id: c.id })}><Trash2 className="h-4 w-4" /></Button>
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
