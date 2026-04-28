import { useState } from "react";
import { useListStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, getListStudentsQueryKey } from "@workspace/api-client-react";
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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Search, Eye, EyeOff } from "lucide-react";

const createSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().email("Email tidak valid").max(200),
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  nim: z.string().min(2).max(20),
  prodi: z.string().min(2).max(100),
  fakultas: z.string().min(2).max(100),
  semester: z.coerce.number().min(1).max(14),
  angkatan: z.coerce.number().min(2000).max(2100),
  kelas: z.string().max(10).optional(),
  phone: z.string().optional(),
});

const updateSchema = z.object({
  nim: z.string().min(2).max(20),
  prodi: z.string().min(2).max(100),
  fakultas: z.string().min(2).max(100),
  semester: z.coerce.number().min(1).max(14),
  kelas: z.string().max(10).optional(),
  phone: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type UpdateValues = z.infer<typeof updateSchema>;

export default function Mahasiswa() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { data, isLoading, isError } = useListStudents({ page, limit: 10, search: search || undefined });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setIsCreateOpen(false);
        createForm.reset();
        toast({ title: "Mahasiswa berhasil ditambahkan" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menambahkan mahasiswa";
        toast({ title: msg, variant: "destructive" });
      },
    }
  });

  const update = useUpdateStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        setEditingId(null);
        toast({ title: "Berhasil diperbarui" });
      }
    }
  });

  const remove = useDeleteStudent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Berhasil dihapus" });
      }
    }
  });

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "", email: "", password: "",
      nim: "", prodi: "", fakultas: "",
      semester: 1, angkatan: new Date().getFullYear(),
      kelas: "", phone: "",
    },
  });

  const editForm = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: { nim: "", prodi: "", fakultas: "", semester: 1, kelas: "", phone: "" },
  });

  const onCreateSubmit = (values: CreateValues) => {
    create.mutate({ data: values });
  };

  const onUpdateSubmit = (values: UpdateValues) => {
    if (editingId) update.mutate({ id: editingId, data: values });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Mahasiswa</h1>
          <p className="text-muted-foreground">Kelola direktori data mahasiswa.</p>
        </div>

        {/* Dialog Tambah Mahasiswa */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) { createForm.reset(); setShowPassword(false); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Tambah Mahasiswa</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Mahasiswa</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Akun Login</div>
                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input placeholder="Siti Rahayu" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="siti@student.unpra.ac.id" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder="Min. 6 karakter" {...field} />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPassword(v => !v)}>
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <Separator />
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Data Akademik</div>
                <FormField control={createForm.control} name="nim" render={({ field }) => (
                  <FormItem><FormLabel>NIM</FormLabel><FormControl><Input placeholder="22010001" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={createForm.control} name="prodi" render={({ field }) => (
                    <FormItem><FormLabel>Program Studi</FormLabel><FormControl><Input placeholder="Teknik Informatika" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={createForm.control} name="fakultas" render={({ field }) => (
                    <FormItem><FormLabel>Fakultas</FormLabel><FormControl><Input placeholder="Teknik" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={createForm.control} name="semester" render={({ field }) => (
                    <FormItem><FormLabel>Semester</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={createForm.control} name="angkatan" render={({ field }) => (
                    <FormItem><FormLabel>Angkatan</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={createForm.control} name="kelas" render={({ field }) => (
                    <FormItem><FormLabel>Kelas <span className="text-muted-foreground font-normal">(opt)</span></FormLabel><FormControl><Input placeholder="A, B..." {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={createForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>No. HP <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel><FormControl><Input placeholder="081234567890" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Mahasiswa
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Dialog Edit Mahasiswa */}
        <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Edit Data Mahasiswa</DialogTitle>
            </DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
                <FormField control={editForm.control} name="nim" render={({ field }) => (
                  <FormItem><FormLabel>NIM</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="prodi" render={({ field }) => (
                    <FormItem><FormLabel>Program Studi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editForm.control} name="fakultas" render={({ field }) => (
                    <FormItem><FormLabel>Fakultas</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="semester" render={({ field }) => (
                    <FormItem><FormLabel>Semester</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editForm.control} name="kelas" render={({ field }) => (
                    <FormItem><FormLabel>Kelas</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={editForm.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>No. HP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={update.isPending}>
                  {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Perubahan
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              className="max-w-sm"
              placeholder="Cari NIM atau Nama..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NIM</TableHead>
                <TableHead>Nama / Email</TableHead>
                <TableHead>Prodi / Fakultas</TableHead>
                <TableHead>Smt / Angkatan / Kelas</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Gagal memuat data mahasiswa. Coba refresh halaman.</TableCell></TableRow>
              ) : data?.students.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Kosong</TableCell></TableRow>
              ) : (
                data?.students.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.nim}</TableCell>
                    <TableCell>
                      <div className="font-medium">{s.name || '-'}</div>
                      <div className="text-xs text-muted-foreground">{s.email || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div>{s.prodi}</div>
                      <div className="text-xs text-muted-foreground">{s.fakultas}</div>
                    </TableCell>
                    <TableCell>
                      <div>Sem: {s.semester} | Thn: {s.angkatan}</div>
                      <div className="text-xs text-muted-foreground">Kelas: {s.kelas || <span className="italic">—</span>}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingId(s.id);
                          editForm.reset({ nim: s.nim, prodi: s.prodi, fakultas: s.fakultas, semester: s.semester, kelas: s.kelas || '', phone: s.phone || '' });
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirm("Hapus mahasiswa ini?") && remove.mutate({ id: s.id })}><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {data && data.pagination.totalPages > 1 && (
            <div className="flex justify-end gap-2 p-4">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Sebelumnya</Button>
              <span className="flex items-center text-sm text-muted-foreground">Hal {page} / {data.pagination.totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.totalPages}>Berikutnya</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
