import { useState } from "react";
import { useListAcademicCalendar, useCreateCalendarEvent, useUpdateCalendarEvent, useDeleteCalendarEvent, getListAcademicCalendarQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, isSameMonth, isToday, isSameDay, isWithinInterval,
  parseISO, addMonths, subMonths,
} from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const schema = z.object({
  namaEvent: z.string().min(3).max(200),
  tanggalMulai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  tanggalSelesai: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  tipe: z.enum(["UTS", "UAS", "Libur", "Registrasi", "KRS", "Wisuda", "Lainnya"]),
  deskripsi: z.string().optional(),
  tahunAjaran: z.string().min(1),
});

type CalendarEventTipe = "UTS" | "UAS" | "Libur" | "Registrasi" | "KRS" | "Wisuda" | "Lainnya";

const TIPE_COLORS: Record<CalendarEventTipe, string> = {
  UTS:         "bg-orange-500",
  UAS:         "bg-red-500",
  Libur:       "bg-green-500",
  Registrasi:  "bg-blue-500",
  KRS:         "bg-purple-500",
  Wisuda:      "bg-yellow-500",
  Lainnya:     "bg-gray-400",
};

const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export default function Kalender() {
  const [page, setPage] = useState(1);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [calMonth, setCalMonth] = useState(() => new Date());

  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);

  const { data, isLoading } = useListAcademicCalendar({
    page, limit: 100,
    from: format(monthStart, "yyyy-MM-dd"),
    to: format(monthEnd, "yyyy-MM-dd"),
  });

  const { data: tableData, isLoading: isTableLoading, isError: isTableError } = useListAcademicCalendar({ page, limit: 10 });

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

  const events = data?.events ?? [];

  const getEventsForDay = (day: Date) =>
    events.filter(e => {
      const start = parseISO(e.tanggalMulai);
      const end = parseISO(e.tanggalSelesai);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });

  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);

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
                <Button type="submit" className="w-full" disabled={create.isPending || update.isPending}>
                  {(create.isPending || update.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Visual Calendar */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              {format(calMonth, "MMMM yyyy", { locale: localeId })}
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCalMonth(new Date())}>
                Hari Ini
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 pt-2">
            {(Object.entries(TIPE_COLORS) as [CalendarEventTipe, string][]).map(([tipe, color]) => (
              <div key={tipe} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("inline-block h-2 w-2 rounded-full", color)} />
                {tipe}
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_ID.map(d => (
              <div key={d} className="py-1 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden">
            {Array.from({ length: leadingBlanks }).map((_, i) => (
              <div key={`blank-${i}`} className="bg-muted/30 min-h-[64px]" />
            ))}
            {daysInMonth.map(day => {
              const dayEvents = getEventsForDay(day);
              const today = isToday(day);
              const sameMonth = isSameMonth(day, calMonth);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "bg-background min-h-[64px] p-1 flex flex-col",
                    !sameMonth && "opacity-40"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium w-5 h-5 flex items-center justify-center rounded-full",
                    today && "bg-primary text-primary-foreground font-bold"
                  )}>
                    {format(day, "d")}
                  </span>
                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {isLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground mx-auto" />
                    ) : (
                      dayEvents.slice(0, 2).map(e => (
                        <div
                          key={e.id}
                          title={e.namaEvent}
                          className={cn(
                            "rounded px-1 text-[10px] leading-4 text-white truncate",
                            TIPE_COLORS[e.tipe as CalendarEventTipe] ?? "bg-gray-400"
                          )}
                        >
                          {e.namaEvent}
                        </div>
                      ))
                    )}
                    {dayEvents.length > 2 && (
                      <span className="text-[10px] text-muted-foreground px-1">+{dayEvents.length - 2} lagi</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Agenda</CardTitle>
        </CardHeader>
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
              {isTableLoading ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto animate-spin text-primary" /></TableCell></TableRow>
              ) : isTableError ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-destructive">Gagal memuat agenda. Coba refresh halaman.</TableCell></TableRow>
              ) : tableData?.events.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada agenda</TableCell></TableRow>
              ) : (
                tableData?.events.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>
                      <div className="font-medium">{e.namaEvent}</div>
                      {e.deskripsi && <div className="text-xs text-muted-foreground">{e.deskripsi}</div>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {format(new Date(e.tanggalMulai), "dd MMM")} – {format(new Date(e.tanggalSelesai), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn("text-white border-0", TIPE_COLORS[e.tipe as CalendarEventTipe] ?? "bg-gray-400")}
                      >
                        {e.tipe}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{e.tahunAjaran}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingId(e.id);
                          form.reset({
                            namaEvent: e.namaEvent,
                            tanggalMulai: format(new Date(e.tanggalMulai), "yyyy-MM-dd"),
                            tanggalSelesai: format(new Date(e.tanggalSelesai), "yyyy-MM-dd"),
                            tipe: e.tipe as z.infer<typeof schema>["tipe"],
                            deskripsi: e.deskripsi || "",
                            tahunAjaran: e.tahunAjaran,
                          });
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => confirm("Hapus agenda ini?") && remove.mutate({ id: e.id })}
                        ><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {tableData && tableData.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">Total: {tableData.pagination.total} agenda</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(tableData.pagination.totalPages, p + 1))} disabled={page >= tableData.pagination.totalPages}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
