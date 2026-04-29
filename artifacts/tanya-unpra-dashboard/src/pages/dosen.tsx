import { useState, useRef } from "react";
import {
  useListLecturers, useCreateLecturer, useUpdateLecturer, useDeleteLecturer,
  useUploadLecturerPhoto,
  getListLecturersQueryKey, useListFakultas, useListProdi,
} from "@workspace/api-client-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, Search, Eye, EyeOff, Camera, UserCircle2 } from "lucide-react";

const createSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(100),
  email: z.string().email("Email tidak valid").max(200),
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  nidn: z.string().min(2).max(20),
  prodi: z.string().min(2, "Pilih program studi").max(100),
  fakultas: z.string().min(2, "Pilih fakultas").max(100),
  jabatan: z.string().optional(),
  expertise: z.string().optional(),
});

const updateSchema = z.object({
  nidn: z.string().min(2).max(20),
  prodi: z.string().min(2).max(100),
  fakultas: z.string().min(2).max(100),
  jabatan: z.string().optional(),
  expertise: z.string().optional(),
});

type CreateValues = z.infer<typeof createSchema>;
type UpdateValues = z.infer<typeof updateSchema>;

function DosenAvatar({ photoUrl, name, size = "sm" }: { photoUrl?: string | null; name?: string | null; size?: "sm" | "lg" }) {
  const [imgError, setImgError] = useState(false);
  const dim = size === "lg" ? "h-20 w-20" : "h-9 w-9";
  const iconSize = size === "lg" ? "h-10 w-10" : "h-5 w-5";

  if (photoUrl && !imgError) {
    return (
      <img
        src={photoUrl}
        alt={name ?? "Foto dosen"}
        className={`${dim} rounded-full object-cover border border-border flex-shrink-0`}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className={`${dim} rounded-full bg-muted flex items-center justify-center flex-shrink-0 border border-border`}>
      <UserCircle2 className={`${iconSize} text-muted-foreground`} />
    </div>
  );
}

export default function Dosen() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingPhotoUrl, setEditingPhotoUrl] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [selectedFakultasId, setSelectedFakultasId] = useState<string>("");
  const [editSelectedFakultasId, setEditSelectedFakultasId] = useState<string>("");

  const { data, isLoading, isError } = useListLecturers({ page, limit: 10, search: search || undefined });
  const { data: fData } = useListFakultas();
  const { data: pData } = useListProdi(selectedFakultasId ? { fakultasId: selectedFakultasId } : {});
  const { data: pDataEdit } = useListProdi(editSelectedFakultasId ? { fakultasId: editSelectedFakultasId } : {});
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const fakultasList = fData?.fakultas ?? [];
  const prodiList = pData?.prodi ?? [];
  const prodiListEdit = pDataEdit?.prodi ?? [];

  const create = useCreateLecturer({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListLecturersQueryKey() });
        setIsCreateOpen(false);
        createForm.reset();
        setSelectedFakultasId("");
        toast({ title: "Dosen berhasil ditambahkan" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menambahkan dosen";
        toast({ title: msg, variant: "destructive" });
      },
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

  const uploadPhoto = useUploadLecturerPhoto({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListLecturersQueryKey() });
        setEditingPhotoUrl(res.lecturer.photoUrl ?? null);
        toast({ title: "Foto berhasil diupload" });
      },
      onError: () => {
        toast({ title: "Gagal upload foto", variant: "destructive" });
      },
    }
  });

  const createForm = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", email: "", password: "", nidn: "", prodi: "", fakultas: "", jabatan: "", expertise: "" },
  });

  const editForm = useForm<UpdateValues>({
    resolver: zodResolver(updateSchema),
    defaultValues: { nidn: "", prodi: "", fakultas: "", jabatan: "", expertise: "" },
  });

  const onCreateSubmit = (values: CreateValues) => {
    create.mutate({ data: values });
  };

  const onUpdateSubmit = (values: UpdateValues) => {
    if (editingId) update.mutate({ id: editingId, data: values });
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingId) return;
    uploadPhoto.mutate({ id: editingId, data: { photo: file } });
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Dosen</h1>
          <p className="text-muted-foreground">Kelola direktori data dosen.</p>
        </div>

        {/* Dialog Tambah Dosen */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) { createForm.reset(); setShowPassword(false); setSelectedFakultasId(""); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Tambah Dosen</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Tambah Dosen</DialogTitle>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Akun Login</div>
                <FormField control={createForm.control} name="name" render={({ field }) => (
                  <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input placeholder="Dr. Budi Santoso" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="email" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" placeholder="budi@unpra.ac.id" {...field} /></FormControl><FormMessage /></FormItem>
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
                <FormField control={createForm.control} name="nidn" render={({ field }) => (
                  <FormItem><FormLabel>NIDN</FormLabel><FormControl><Input placeholder="0123456789" {...field} /></FormControl><FormMessage /></FormItem>
                )} />

                <FormField control={createForm.control} name="fakultas" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fakultas</FormLabel>
                    <Select onValueChange={(val) => {
                      const f = fakultasList.find(f => f.name === val);
                      field.onChange(val);
                      setSelectedFakultasId(f?.id ?? "");
                      createForm.setValue("prodi", "");
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={fakultasList.length === 0 ? "Belum ada fakultas — tambah di menu Fakultas & Prodi" : "Pilih fakultas..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fakultasList.map((f) => (
                          <SelectItem key={f.id} value={f.name}>{f.name} ({f.singkatan})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={createForm.control} name="prodi" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program Studi</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={!selectedFakultasId}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={!selectedFakultasId ? "Pilih fakultas dulu" : prodiList.length === 0 ? "Belum ada prodi untuk fakultas ini" : "Pilih prodi..."} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {prodiList.map((p) => (
                          <SelectItem key={p.id} value={p.name}>{p.name} ({p.singkatan})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={createForm.control} name="jabatan" render={({ field }) => (
                  <FormItem><FormLabel>Jabatan <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel><FormControl><Input placeholder="Dosen Tetap" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={createForm.control} name="expertise" render={({ field }) => (
                  <FormItem><FormLabel>Keahlian <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel><FormControl><Input placeholder="Pemrograman Web, Basis Data" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <p className="text-xs text-muted-foreground">Foto dosen bisa ditambahkan setelah dosen berhasil disimpan melalui tombol Edit.</p>
                <Button type="submit" className="w-full" disabled={create.isPending}>
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Dosen
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Dialog Edit Dosen */}
        <Dialog open={!!editingId} onOpenChange={(open) => { if (!open) { setEditingId(null); setEditSelectedFakultasId(""); setEditingPhotoUrl(null); setEditingName(null); } }}>
          <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Data Dosen</DialogTitle>
            </DialogHeader>

            {/* Foto Section */}
            <div className="flex flex-col items-center gap-3 py-2">
              <DosenAvatar photoUrl={editingPhotoUrl} name={editingName} size="lg" />
              <div className="text-center">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhotoChange}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploadPhoto.isPending}
                  onClick={() => photoInputRef.current?.click()}
                >
                  {uploadPhoto.isPending
                    ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Mengupload...</>
                    : <><Camera className="mr-2 h-3 w-3" /> {editingPhotoUrl ? "Ganti Foto" : "Upload Foto"}</>
                  }
                </Button>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP · maks 5MB · opsional</p>
              </div>
            </div>

            <Separator />

            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onUpdateSubmit)} className="space-y-4">
                <FormField control={editForm.control} name="nidn" render={({ field }) => (
                  <FormItem><FormLabel>NIDN</FormLabel><FormControl><Input {...field} disabled /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="fakultas" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fakultas</FormLabel>
                    <Select onValueChange={(val) => {
                      const f = fakultasList.find(f => f.name === val);
                      field.onChange(val);
                      setEditSelectedFakultasId(f?.id ?? "");
                      editForm.setValue("prodi", "");
                    }} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Pilih fakultas..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {fakultasList.map((f) => (
                          <SelectItem key={f.id} value={f.name}>{f.name} ({f.singkatan})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="prodi" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Program Studi</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Pilih prodi..." /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(editSelectedFakultasId ? prodiListEdit : prodiList).map((p) => (
                          <SelectItem key={p.id} value={p.name}>{p.name} ({p.singkatan})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="jabatan" render={({ field }) => (
                  <FormItem><FormLabel>Jabatan</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={editForm.control} name="expertise" render={({ field }) => (
                  <FormItem><FormLabel>Keahlian</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
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
            <Input className="max-w-sm" placeholder="Cari NIDN atau Nama..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[52px]"></TableHead>
                <TableHead>NIDN</TableHead>
                <TableHead>Nama / Email</TableHead>
                <TableHead>Prodi / Fakultas</TableHead>
                <TableHead>Jabatan / Keahlian</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-destructive">Gagal memuat data dosen. Coba refresh halaman.</TableCell></TableRow>
              ) : data?.lecturers.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="h-24 text-center text-muted-foreground">Kosong</TableCell></TableRow>
              ) : (
                data?.lecturers.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="pl-4">
                      <DosenAvatar photoUrl={l.photoUrl} name={l.name} size="sm" />
                    </TableCell>
                    <TableCell className="font-medium">{l.nidn}</TableCell>
                    <TableCell>
                      <div className="font-medium">{l.name || '-'}</div>
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
                          const matchFakultas = fakultasList.find(f => f.name === l.fakultas);
                          setEditingId(l.id);
                          setEditingPhotoUrl(l.photoUrl ?? null);
                          setEditingName(l.name ?? null);
                          setEditSelectedFakultasId(matchFakultas?.id ?? "");
                          editForm.reset({ nidn: l.nidn, prodi: l.prodi, fakultas: l.fakultas, jabatan: l.jabatan || '', expertise: l.expertise || '' });
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirm("Hapus dosen ini?") && remove.mutate({ id: l.id })}><Trash2 className="h-4 w-4" /></Button>
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
