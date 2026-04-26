import { useState } from "react";
import { useListAcademicCalendar, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, getListAcademicCalendarQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  namaEvent: z.string().min(3).max(200),
  tanggalMulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  tanggalSelesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  tipe: z.enum(["UTS", "UAS", "Libur", "Registrasi", "KRS", "Wisuda", "Lainnya"]),
  deskripsi: z.string().optional(),
  tahunAjaran: z.string().min(1),
});

export default function Kalender() {
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { data, isLoading } = useListAcademicCalendar({ page, limit: 10 });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateCalendarEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAcademicCalendarQueryKey() });
        setIsCreateOpen(false);
        toast({ title: "Event ditambahkan" });
      }
    }
  });

  const update = useUpdateCalendarEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAcademicCalendarQueryKey() });
        setEditingId(null);
        toast({ title: "Event diperbarui" });
      }
    }
  });

  const remove = useDeleteCalendarEvent({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAcademicCalendarQueryKey() });
        toast({ title: "Event dihapus" });
      }
    }
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { namaEvent: "", tanggalMulai: "", tanggalSelesai: "", tipe: "Lainnya", deskripsi: "", tahunAjaran: "2024/2025" },
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
          <h1 className="text-3xl font-bold tracking-tight">Kalender Akademik</h1>
          <p className="text-muted-foreground">Jadwal kegiatan akademik universitas.</p>
        </div>
        <Dialog open={isCreateOpen || !!editingId} onOpenChange={(open) => {
          if (!open) { setIsCreateOpen(false); setEditingId(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Tambah Agenda</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Tambah"} Agenda</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="namaEvent" render={({ field }) => (
                  <FormItem><FormLabel>Nama Agenda</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="tanggalMulai" render={({ field }) => (
                    <FormItem><FormLabel>Tanggal Mulai</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="tanggalSelesai" render={({ field }) => (
                    <FormItem><FormLabel>Tanggal Selesai</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="tipe" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          {["UTS", "UAS", "Libur", "Registrasi", "KRS", "Wisuda", "Lainnya"].map(t => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="tahunAjaran" render={({ field }) => (
                    <FormItem><FormLabel>Tahun Ajaran</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="deskripsi" render={({ field }) => (
                  <FormItem><FormLabel>Deskripsi</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
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
                <TableHead>Agenda</TableHead>
                <TableHead>Tanggal</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Tahun Ajaran</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow>
              ) : data?.events.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada agenda</TableCell></TableRow>
              ) : (
                data?.events.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.namaEvent}</div>
                      {e.deskripsi && <div className="text-xs text-muted-foreground">{e.deskripsi}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(e.tanggalMulai), "dd MMM")} - {format(new Date(e.tanggalSelesai), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell><Badge variant="secondary">{e.tipe}</Badge></TableCell>
                    <TableCell className="text-sm">{e.tahunAjaran}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingId(e.id);
                          form.reset({ 
                            namaEvent: e.namaEvent, 
                            tanggalMulai: format(new Date(e.tanggalMulai), "yyyy-MM-dd"), 
                            tanggalSelesai: format(new Date(e.tanggalSelesai), "yyyy-MM-dd"), 
                            tipe: e.tipe, 
                            deskripsi: e.deskripsi || '', 
                            tahunAjaran: e.tahunAjaran 
                          });
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirm("Hapus?") && remove.mutate({ id: e.id })}><Trash2 className="h-4 w-4" /></Button>
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
