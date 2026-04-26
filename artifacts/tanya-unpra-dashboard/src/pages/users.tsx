import { useState } from "react";
import { useListUsers, useDeleteUser, useCreateAdminUser, getListUsersQueryKey, UserItem, ListUsersRole } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Search, Trash2, Loader2, ChevronLeft, ChevronRight, UserPlus, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const adminSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

const ROLE_LABELS: Record<string, string> = { admin: "Admin", dosen: "Dosen", mahasiswa: "Mahasiswa" };

export default function Users() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const [isAddAdminOpen, setIsAddAdminOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useListUsers({
    page,
    limit: 20,
    search: search || undefined,
    role: (roleFilter as ListUsersRole) || undefined,
  });

  const deleteUser = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "User berhasil dihapus" });
      },
      onError: (err) => {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Gagal menghapus user";
        toast({ title: "Gagal", description: message, variant: "destructive" });
      },
    },
  });

  const createAdmin = useCreateAdminUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        setIsAddAdminOpen(false);
        adminForm.reset();
        toast({ title: "Akun admin berhasil dibuat" });
      },
      onError: (err) => {
        const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || "Gagal membuat akun admin";
        toast({ title: "Gagal", description: message, variant: "destructive" });
      },
    },
  });

  const adminForm = useForm<z.infer<typeof adminSchema>>({
    resolver: zodResolver(adminSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onAddAdmin = (values: z.infer<typeof adminSchema>) => {
    createAdmin.mutate({ data: values });
  };

  const handleDelete = (user: UserItem) => {
    if (user.role === "admin") {
      toast({ title: "Tidak dapat menghapus akun admin", variant: "destructive" });
      return;
    }
    if (!confirm(`Yakin ingin menghapus user "${user.name}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    deleteUser.mutate({ id: user.id });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen User</h1>
          <p className="text-muted-foreground">Lihat dan kelola semua akun pengguna sistem.</p>
        </div>

        <Dialog open={isAddAdminOpen} onOpenChange={(open) => {
          if (!open) { setIsAddAdminOpen(false); adminForm.reset(); setShowPassword(false); }
          else setIsAddAdminOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsAddAdminOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" /> Tambah Admin
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Tambah Akun Admin</DialogTitle>
            </DialogHeader>
            <Form {...adminForm}>
              <form onSubmit={adminForm.handleSubmit(onAddAdmin)} className="space-y-4 pt-2">
                <FormField control={adminForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Lengkap</FormLabel>
                    <FormControl><Input placeholder="Nama admin..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={adminForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" placeholder="admin@unpra.ac.id" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={adminForm.control} name="password" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Minimal 8 karakter"
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <Button type="submit" className="w-full" disabled={createAdmin.isPending}>
                  {createAdmin.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Buat Akun Admin
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 sm:max-w-sm"
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="sm:max-w-[180px]">
                <SelectValue placeholder="Semua Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Role</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="dosen">Dosen</SelectItem>
                <SelectItem value="mahasiswa">Mahasiswa</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Peran</TableHead>
                <TableHead>Tanggal Daftar</TableHead>
                <TableHead className="w-[80px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
                  </TableCell>
                </TableRow>
              ) : data?.users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    Tidak ada user ditemukan.
                  </TableCell>
                </TableRow>
              ) : (
                data?.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.role === "admin" ? "default" : u.role === "dosen" ? "secondary" : "outline"}
                        className="capitalize"
                      >
                        {ROLE_LABELS[u.role] ?? u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(u.createdAt), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        disabled={u.role === "admin" || deleteUser.isPending}
                        onClick={() => handleDelete(u)}
                        title={u.role === "admin" ? "Tidak dapat menghapus admin" : "Hapus user"}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {data?.pagination && data.pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                {data.pagination.total} user · Halaman {data.pagination.page} dari {data.pagination.totalPages}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(data.pagination.totalPages, p + 1))} disabled={page === data.pagination.totalPages}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
