import { useState } from "react";
import { useListApiKeys, useCreateApiKey, useRevokeApiKey, getListApiKeysQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Key, Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  name: z.string().min(3).max(100),
  expiresInDays: z.coerce.number().min(1).max(365).optional(),
});

export default function ApiKeys() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newKey, setNewKey] = useState<{ key: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useListApiKeys();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const create = useCreateApiKey({
    mutation: {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
        setNewKey({ key: res.apiKey.key, name: res.apiKey.name });
        toast({ title: "API Key berhasil dibuat" });
      }
    }
  });

  const revoke = useRevokeApiKey({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListApiKeysQueryKey() });
        toast({ title: "API Key berhasil dicabut" });
      }
    }
  });

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", expiresInDays: 30 },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    create.mutate({ data: values });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Disalin ke clipboard" });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">API Keys</h1>
          <p className="text-muted-foreground">Kelola akses API untuk aplikasi klien.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          if (!open) { setIsCreateOpen(false); setNewKey(null); form.reset(); }
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> Buat API Key</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Buat API Key Baru</DialogTitle>
              <DialogDescription>
                API Key memberikan akses ke endpoint sistem ini.
              </DialogDescription>
            </DialogHeader>

            {newKey ? (
              <div className="space-y-4">
                <div className="rounded-md bg-muted p-4 border border-border">
                  <p className="text-sm font-medium mb-2">Simpan key ini sekarang. Anda tidak akan bisa melihatnya lagi.</p>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={newKey.key} className="font-mono text-sm bg-background" />
                    <Button size="icon" variant="outline" onClick={() => copyToClipboard(newKey.key)}>
                      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button className="w-full" onClick={() => { setIsCreateOpen(false); setNewKey(null); form.reset(); }}>
                  Selesai
                </Button>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Nama Kunci</FormLabel><FormControl><Input placeholder="Contoh: Android App V1" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="expiresInDays" render={({ field }) => (
                    <FormItem><FormLabel>Masa Berlaku (Hari)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={create.isPending}>
                    {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Key
                  </Button>
                </form>
              </Form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Daftar API Keys Aktif
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Prefix</TableHead>
                <TableHead>Dibuat</TableHead>
                <TableHead>Terakhir Digunakan</TableHead>
                <TableHead>Berakhir</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="mx-auto animate-spin" /></TableCell></TableRow>
              ) : data?.apiKeys?.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">Belum ada API key</TableCell></TableRow>
              ) : (
                data?.apiKeys?.map(k => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.name}</TableCell>
                    <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{k.keyPrefix}...</code></TableCell>
                    <TableCell className="text-sm">{format(new Date(k.createdAt), "dd MMM yyyy")}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{k.lastUsedAt ? format(new Date(k.lastUsedAt), "dd MMM yyyy HH:mm") : 'Belum pernah'}</TableCell>
                    <TableCell className="text-sm">
                      {k.expiresAt ? format(new Date(k.expiresAt), "dd MMM yyyy") : 'Selamanya'}
                    </TableCell>
                    <TableCell>
                      {k.isActive ? <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20">Aktif</Badge> : <Badge variant="destructive">Dicabut</Badge>}
                    </TableCell>
                    <TableCell>
                      {k.isActive && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => confirm("Cabut key ini? Aplikasi yang menggunakannya akan kehilangan akses.") && revoke.mutate({ id: k.id })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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
