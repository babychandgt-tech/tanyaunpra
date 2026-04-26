import { useEffect, useState } from "react";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import { Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function ApiDocs() {
  const [spec, setSpec] = useState<object | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/docs/spec", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setSpec(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsError(true);
        setIsLoading(false);
      });
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (isError || !spec) {
    return (
      <div className="max-w-lg mx-auto mt-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Gagal memuat dokumentasi</AlertTitle>
          <AlertDescription>
            Tidak dapat mengambil spesifikasi API. Coba refresh halaman.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dokumentasi API</h1>
        <p className="text-muted-foreground mt-1">
          Referensi lengkap semua endpoint API Tanya UNPRA
        </p>
      </div>
      <div className="rounded-lg border bg-white overflow-hidden">
        <SwaggerUI
          spec={spec}
          docExpansion="list"
          defaultModelsExpandDepth={1}
          displayRequestDuration
          filter
          tryItOutEnabled
          requestInterceptor={(req: Record<string, unknown>) => {
            const token = localStorage.getItem("token");
            if (token) {
              const headers = (req.headers as Record<string, string>) ?? {};
              headers["Authorization"] = `Bearer ${token}`;
              req.headers = headers;
            }
            return req;
          }}
        />
      </div>
    </div>
  );
}
