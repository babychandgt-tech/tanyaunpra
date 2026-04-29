import { useState } from "react";
import {
  useListFakultas, useCreateFakultas, useUpdateFakultas, useDeleteFakultas,
  useListProdi, useCreateProdi, useUpdateProdi, useDeleteProdi,
  getListFakultasQueryKey, getListProdiQueryKey,
} from "@workspace/api-client-react";
import type { ProdiItem } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Edit, Trash2, School, BookOpen, GripVertical } from "lucide-react";

const fakultasSchema = z.object({
  name: z.string().min(2, "Minimal 2 karakter").max(200),
  singkatan: z.string().min(1, "Singkatan wajib diisi").max(20),
});
type FakultasValues = z.infer<typeof fakultasSchema>;

const prodiSchema = z.object({
  name: z.string().min(2, "Minimal 2 karakter").max(200),
  singkatan: z.string().min(1, "Singkatan wajib diisi").max(20),
  fakultasId: z.string().uuid("Pilih fakultas"),
});
type ProdiValues = z.infer<typeof prodiSchema>;

function SortableProdiRow({
  prodi,
  onEdit,
  onDelete,
}: {
  prodi: ProdiItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: prodi.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between px-4 py-2.5 bg-background hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <button
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0 touch-none"
          tabIndex={-1}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{prodi.name}</p>
          <Badge variant="secondary" className="text-xs mt-0.5">{prodi.singkatan}</Badge>
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0 ml-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
          <Edit className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function FakultasProdi() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [fakultasDialog, setFakultasDialog] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [prodiDialog, setProdiDialog] = useState<{ open: boolean; editId?: string }>({ open: false });
  const [localProdiOverride, setLocalProdiOverride] = useState<ProdiItem[] | null>(null);

  const { data: fData, isLoading: fLoading } = useListFakultas();
  const { data: pData, isLoading: pLoading } = useListProdi();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateProdi = useUpdateProdi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProdiQueryKey() });
        setProdiDialog({ open: false });
        toast({ title: "Berhasil diperbarui" });
      },
    }
  });

  const createFakultas = useCreateFakultas({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFakultasQueryKey() });
        setFakultasDialog({ open: false });
        fakultasForm.reset();
        toast({ title: "Fakultas berhasil ditambahkan" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menyimpan";
        toast({ title: msg, variant: "destructive" });
      },
    }
  });

  const updateFakultas = useUpdateFakultas({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFakultasQueryKey() });
        setFakultasDialog({ open: false });
        toast({ title: "Berhasil diperbarui" });
      },
    }
  });

  const deleteFakultas = useDeleteFakultas({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFakultasQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListProdiQueryKey() });
        setLocalProdiOverride(null);
        toast({ title: "Fakultas berhasil dihapus" });
      },
      onError: () => {
        toast({ title: "Gagal menghapus. Pastikan tidak ada prodi yang terdaftar.", variant: "destructive" });
      },
    }
  });

  const createProdi = useCreateProdi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProdiQueryKey() });
        setLocalProdiOverride(null);
        setProdiDialog({ open: false });
        prodiForm.reset();
        toast({ title: "Prodi berhasil ditambahkan" });
      },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Gagal menyimpan";
        toast({ title: msg, variant: "destructive" });
      },
    }
  });

  const deleteProdi = useDeleteProdi({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProdiQueryKey() });
        setLocalProdiOverride(null);
        toast({ title: "Prodi berhasil dihapus" });
      },
    }
  });

  const fakultasForm = useForm<FakultasValues>({
    resolver: zodResolver(fakultasSchema),
    defaultValues: { name: "", singkatan: "" },
  });

  const prodiForm = useForm<ProdiValues>({
    resolver: zodResolver(prodiSchema),
    defaultValues: { name: "", singkatan: "", fakultasId: "" },
  });

  const onFakultasSubmit = (values: FakultasValues) => {
    if (fakultasDialog.editId) {
      updateFakultas.mutate({ id: fakultasDialog.editId, data: values });
    } else {
      createFakultas.mutate({ data: values });
    }
  };

  const onProdiSubmit = (values: ProdiValues) => {
    if (prodiDialog.editId) {
      updateProdi.mutate({ id: prodiDialog.editId, data: values });
    } else {
      createProdi.mutate({ data: values });
    }
  };

  const handleDragEnd = (event: DragEndEvent, fakultasId: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const currentList = localProdiOverride ?? (pData?.prodi ?? []);
    const fakultasProdi = currentList.filter(p => p.fakultasId === fakultasId);
    const otherProdi = currentList.filter(p => p.fakultasId !== fakultasId);

    const oldIndex = fakultasProdi.findIndex(p => p.id === String(active.id));
    const newIndex = fakultasProdi.findIndex(p => p.id === String(over.id));
    const reordered = arrayMove(fakultasProdi, oldIndex, newIndex);
    const reorderedWithOrder = reordered.map((p, i) => ({ ...p, sortOrder: i }));

    setLocalProdiOverride([...otherProdi, ...reorderedWithOrder]);

    reorderedWithOrder.forEach((p) => {
      updateProdi.mutate(
        { id: p.id, data: { sortOrder: p.sortOrder } },
        { onSuccess: () => {}, onError: () => {} }
      );
    });
  };

  const fakultasList = fData?.fakultas ?? [];
  const prodiList: ProdiItem[] = localProdiOverride ?? (pData?.prodi ?? []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data Fakultas & Prodi</h1>
        <p className="text-muted-foreground">Kelola daftar fakultas dan program studi. Data ini digunakan saat mendaftarkan dosen dan mahasiswa.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ─── FAKULTAS ─────────────────────────────── */}
        <Card>
          <div className="flex flex-row items-start justify-between p-6 pb-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-base">
                <School className="h-5 w-5" /> Fakultas
              </div>
              <p className="text-sm text-muted-foreground">Daftar fakultas yang tersedia</p>
            </div>
            <Button size="sm" onClick={() => { fakultasForm.reset({ name: "", singkatan: "" }); setFakultasDialog({ open: true }); }}>
              <Plus className="mr-1 h-4 w-4" /> Tambah
            </Button>
          </div>
          <CardContent className="p-0">
            {fLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
            ) : fakultasList.length === 0 ? (
              <p className="text-center text-muted-foreground py-8 text-sm">Belum ada fakultas. Tambahkan dulu.</p>
            ) : (
              <div className="divide-y border-t">
                {fakultasList.map((f) => {
                  const count = prodiList.filter(p => p.fakultasId === f.id).length;
                  return (
                    <div key={f.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="font-medium text-sm">{f.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{f.singkatan}</Badge>
                          <span className="text-xs text-muted-foreground">{count} prodi</span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          fakultasForm.reset({ name: f.name, singkatan: f.singkatan });
                          setFakultasDialog({ open: true, editId: f.id });
                        }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => {
                          if (confirm(`Hapus fakultas "${f.name}"? Semua prodi di dalamnya juga akan terhapus.`)) {
                            deleteFakultas.mutate({ id: f.id });
                          }
                        }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── PRODI PER FAKULTAS ───────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <span className="font-semibold text-base">Program Studi</span>
            </div>
            <Button size="sm" onClick={() => { prodiForm.reset({ name: "", singkatan: "", fakultasId: "" }); setProdiDialog({ open: true }); }}
              disabled={fakultasList.length === 0}>
              <Plus className="mr-1 h-4 w-4" /> Tambah
            </Button>
          </div>

          {pLoading || fLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : fakultasList.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">Tambahkan fakultas terlebih dahulu.</CardContent></Card>
          ) : (
            fakultasList.map((f) => {
              const items = prodiList
                .filter(p => p.fakultasId === f.id)
                .sort((a, b) => a.sortOrder - b.sortOrder);
              return (
                <Card key={f.id}>
                  <CardHeader className="py-3 px-4 border-b bg-muted/30 rounded-t-lg">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-xs">{f.singkatan}</Badge>
                      <span className="font-medium text-sm">{f.name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{items.length} prodi</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {items.length === 0 ? (
                      <p className="text-center text-muted-foreground text-xs py-4">Belum ada prodi di fakultas ini.</p>
                    ) : (
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(e) => handleDragEnd(e, f.id)}
                      >
                        <SortableContext items={items.map(p => p.id)} strategy={verticalListSortingStrategy}>
                          <div className="divide-y">
                            {items.map((p) => (
                              <SortableProdiRow
                                key={p.id}
                                prodi={p}
                                onEdit={() => {
                                  prodiForm.reset({ name: p.name, singkatan: p.singkatan, fakultasId: p.fakultasId });
                                  setProdiDialog({ open: true, editId: p.id });
                                }}
                                onDelete={() => {
                                  if (confirm(`Hapus prodi "${p.name}"?`)) deleteProdi.mutate({ id: p.id });
                                }}
                              />
                            ))}
                          </div>
                        </SortableContext>
                      </DndContext>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* ─── DIALOG FAKULTAS ──────────────────────── */}
      <Dialog open={fakultasDialog.open} onOpenChange={(open) => setFakultasDialog({ open })}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{fakultasDialog.editId ? "Edit" : "Tambah"} Fakultas</DialogTitle>
          </DialogHeader>
          <Form {...fakultasForm}>
            <form onSubmit={fakultasForm.handleSubmit(onFakultasSubmit)} className="space-y-4">
              <FormField control={fakultasForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nama Fakultas</FormLabel><FormControl><Input placeholder="Fakultas Teknik" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={fakultasForm.control} name="singkatan" render={({ field }) => (
                <FormItem><FormLabel>Singkatan</FormLabel><FormControl><Input placeholder="FT" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createFakultas.isPending || updateFakultas.isPending}>
                {(createFakultas.isPending || updateFakultas.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG PRODI ─────────────────────────── */}
      <Dialog open={prodiDialog.open} onOpenChange={(open) => setProdiDialog({ open })}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{prodiDialog.editId ? "Edit" : "Tambah"} Program Studi</DialogTitle>
          </DialogHeader>
          <Form {...prodiForm}>
            <form onSubmit={prodiForm.handleSubmit(onProdiSubmit)} className="space-y-4">
              <FormField control={prodiForm.control} name="name" render={({ field }) => (
                <FormItem><FormLabel>Nama Program Studi</FormLabel><FormControl><Input placeholder="Teknik Informatika" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={prodiForm.control} name="singkatan" render={({ field }) => (
                <FormItem><FormLabel>Singkatan</FormLabel><FormControl><Input placeholder="TI" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={prodiForm.control} name="fakultasId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Fakultas</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Pilih fakultas..." /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {fakultasList.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.name} ({f.singkatan})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" className="w-full" disabled={createProdi.isPending || updateProdi.isPending}>
                {(createProdi.isPending || updateProdi.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
