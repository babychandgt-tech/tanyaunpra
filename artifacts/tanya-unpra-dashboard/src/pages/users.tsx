import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Users as UsersIcon, Plus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function Users() {
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // TODO: Wire up with actual API when useListUsers hook exists
  const isLoading = false;
  const mockUsers = [
    { id: "1", name: "Admin Utama", email: "admin@unpra.ac.id", role: "admin", createdAt: "2024-01-01T00:00:00Z" },
    { id: "2", name: "Dosen Penguji", email: "dosen@unpra.ac.id", role: "dosen", createdAt: "2024-01-02T00:00:00Z" },
    { id: "3", name: "Mahasiswa Teladan", email: "mhs@unpra.ac.id", role: "mahasiswa", createdAt: "2024-01-03T00:00:00Z" },
  ];

  const handleAction = () => {
    toast({
      title: "Belum Tersedia",
      description: "Fitur manajemen user akan tersedia setelah integrasi API selesai.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manajemen User</h1>
          <p className="text-muted-foreground">Kelola hak akses dan peran pengguna aplikasi.</p>
        </div>
        <Button onClick={handleAction}>
          <Plus className="mr-2 h-4 w-4" /> Tambah User
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input 
              className="max-w-sm" 
              placeholder="Cari Nama atau Email..." 
              value={search} 
              onChange={(e) => setSearch(e.target.value)} 
            />
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
                <TableHead className="w-[100px]">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
                </TableRow>
              ) : mockUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">Tidak ada user ditemukan</TableCell>
                </TableRow>
              ) : (
                mockUsers.map(u => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant={u.role === 'admin' ? 'default' : u.role === 'dosen' ? 'secondary' : 'outline'} className="capitalize">
                        {u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(u.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={handleAction}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={handleAction}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
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
