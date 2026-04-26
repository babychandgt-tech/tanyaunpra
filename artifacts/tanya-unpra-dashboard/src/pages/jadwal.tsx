import { useState } from "react";
import { useListSchedules, useCreateSchedule, useUpdateSchedule, useDeleteSchedule, getListSchedulesQueryKey, useListCourses, Schedule } from "@workspace/api-client-react";
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
import { Loader2, Plus, Edit, Trash2, Clock, Calendar, Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const HARI_LIST = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"] as const;

const scheduleSchema = z.object({
  courseId: z.string().min(1, "Pilih mata kuliah"),
  lecturerId: z.string().optional(),
  hari: z.enum(HARI_LIST),
  jamMulai: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:MM"),
  jamSelesai: z.string().regex(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, "Format HH:MM"),
  ruangan: z.string().min(1, "Wajib diisi").max(50),
  kelas: z.string().max(10).optional(),
  semester: z.string().min(1, "Wajib diisi"),
  tahunAjaran: z.string().min(1, "Wajib diisi"),
});

export default function Jadwal() {
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [filterProdi, setFilterProdi] = useState("");
  const [filterSemester, setFilterSemester] = useState("");
  const [filterHari, setFilterHari] = useState<string>("");

  const { data, isLoading, isError } = useListSchedules({
    page,
    limit: 20,
    prodi: filterProdi || undefined,
    semester: filterSemester || undefined,
    hari: (filterHari as (typeof HARI_LIST)[number]) || undefined,
  });
  const { data: courses } = useListCourses({ limit: 100 });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createSchedule = useCreateSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        setIsCreateOpen(false);
        toast({ title: "Jadwal berhasil ditambahkan" });
      }
    }
  });

  const updateSchedule = useUpdateSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        setEditingId(null);
        toast({ title: "Jadwal berhasil diperbarui" });
      }
    }
  });

  const deleteSchedule = useDeleteSchedule({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSchedulesQueryKey() });
        toast({ title: "Jadwal berhasil dihapus" });
      }
    }
  });

  const form = useForm<z.infer<typeof scheduleSchema>>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: { courseId: "", hari: "Senin", jamMulai: "08:00", jamSelesai: "10:00", ruangan: "", kelas: "", semester: "Ganjil", tahunAjaran: "2024/2025" },
  });

  const onSubmit = (values: z.infer<typeof scheduleSchema>) => {
    if (editingId) {
      updateSchedule.mutate({ id: editingId, data: values });
    } else {
      createSchedule.mutate({ data: values });
    }
  };

  const handleEdit = (schedule: Schedule) => {
    setEditingId(schedule.id);
    form.reset({
      courseId: schedule.courseId,
      lecturerId: schedule.lecturerId || "",
      hari: schedule.hari,
      jamMulai: schedule.jamMulai,
      jamSelesai: schedule.jamSelesai,
      ruangan: schedule.ruangan,
      kelas: schedule.kelas || "",
      semester: schedule.semester,
      tahunAjaran: schedule.tahunAjaran,
    });
  };

  const handleDelete = (id: string) => {
    if (confirm("Yakin ingin menghapus jadwal ini?")) {
      deleteSchedule.mutate({ id });
    }
  };

  const hasFilter = !!filterProdi || !!filterSemester || !!filterHari;

  const clearFilters = () => {
    setFilterProdi("");
    setFilterSemester("");
    setFilterHari("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jadwal Kuliah</h1>
          <p className="text-muted-foreground">Kelola jadwal perkuliahan mahasiswa.</p>
        </div>
        <Dialog open={isCreateOpen || !!editingId} onOpenChange={(open) => {
          if (!open) { setIsCreateOpen(false); setEditingId(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Tambah Jadwal
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Jadwal" : "Tambah Jadwal Baru"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="courseId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Mata Kuliah</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Pilih Matkul" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {courses?.courses.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.kode} - {c.nama}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="hari" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hari</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {HARI_LIST.map(h => (
                            <SelectItem key={h} value={h}>{h}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="ruangan" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ruangan</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="jamMulai" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jam Mulai</FormLabel>
                      <FormControl><Input {...field} type="time" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="jamSelesai" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Jam Selesai</FormLabel>
                      <FormControl><Input {...field} type="time" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <FormField control={form.control} name="kelas" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Kelas <span className="text-muted-foreground font-normal">(opsional)</span></FormLabel>
                      <FormControl><Input placeholder="A, B, C..." {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="semester" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Semester</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {["Ganjil", "Genap"].map(s => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="tahunAjaran" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tahun Ajaran</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <Button type="submit" className="w-full" disabled={createSchedule.isPending || updateSchedule.isPending}>
                  {(createSchedule.isPending || updateSchedule.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan Jadwal
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4" /> Filter Jadwal
          </CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Input
              placeholder="Filter Prodi..."
              value={filterProdi}
              onChange={(e) => { setFilterProdi(e.target.value); setPage(1); }}
              className="sm:max-w-[200px]"
            />
            <Select value={filterSemester} onValueChange={(v) => { setFilterSemester(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="sm:max-w-[160px]">
                <SelectValue placeholder="Semua Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Semester</SelectItem>
                <SelectItem value="Ganjil">Ganjil</SelectItem>
                <SelectItem value="Genap">Genap</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterHari} onValueChange={(v) => { setFilterHari(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="sm:max-w-[160px]">
                <SelectValue placeholder="Semua Hari" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Hari</SelectItem>
                {HARI_LIST.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
              </SelectContent>
            </Select>
            {hasFilter && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-fit">
                <X className="mr-1 h-4 w-4" /> Reset
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mata Kuliah</TableHead>
                <TableHead>Waktu & Ruang</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Semester / TA</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /></TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Gagal memuat data jadwal. Coba refresh halaman.</TableCell></TableRow>
              ) : data?.schedules.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada jadwal</TableCell></TableRow>
              ) : (
                data?.schedules.map(s => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.courseNama}</div>
                      <div className="text-xs text-muted-foreground">{s.courseKode} | Dosen: {s.lecturerName || '-'}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar className="h-3 w-3" />
                        <Badge variant="outline" className="text-xs">{s.hari}</Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm mt-1">
                        <Clock className="h-3 w-3" /> {s.jamMulai} - {s.jamSelesai} | {s.ruangan}
                      </div>
                    </TableCell>
                    <TableCell>
                      {s.kelas ? <Badge variant="secondary">{s.kelas}</Badge> : <span className="text-xs text-muted-foreground italic">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{s.semester}</div>
                      <div className="text-xs text-muted-foreground">{s.tahunAjaran}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
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
