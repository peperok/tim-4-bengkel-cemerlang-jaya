"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

const skemaSesuaikanStok = z.object({
  stok_fisik: z.number().min(0, "Stok fisik minimal 0"),
  alasan: z.string().trim().min(1, "Alasan penyesuaian wajib diisi"),
});

type DataSesuaikanStok = z.infer<typeof skemaSesuaikanStok>;

export function DialogSesuaikanStok({
  itemId,
  namaItem,
  stokSekarang,
}: {
  itemId: string;
  namaItem: string;
  stokSekarang: number;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<DataSesuaikanStok>({
    resolver: zodResolver(skemaSesuaikanStok),
    defaultValues: {
      stok_fisik: stokSekarang,
      alasan: "",
    },
  });

  const stokFisikInput = form.watch("stok_fisik");
  const selisih = (Number(stokFisikInput) || 0) - stokSekarang;

  async function kirim(data: DataSesuaikanStok) {
    setLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc("sesuaikan_stok", {
        p_item: itemId,
        p_stok_fisik: data.stok_fisik,
        p_alasan: data.alasan,
      });

      if (error) {
        toast.error("Gagal menyesuaikan stok: " + error.message);
        setLoading(false);
        return;
      }

      toast.success(`Stok ${namaItem} berhasil disesuaikan menjadi ${data.stok_fisik}`);
      setBuka(false);
      form.reset();
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat menyesuaikan stok");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) form.reset({ stok_fisik: stokSekarang, alasan: "" });
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <SlidersHorizontal className="size-3.5" />
          Sesuaikan Stok
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Penyesuaian Stok Fisik</DialogTitle>
          <DialogDescription>
            Menyesuaikan stok untuk <strong>{namaItem}</strong> berdasarkan hitung fisik gudang.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(kirim)} className="space-y-4">
          <FieldGroup>
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stok sistem saat ini:</span>
                <span className="font-semibold tabular-nums">{stokSekarang}</span>
              </div>
              <div className="mt-1 flex justify-between">
                <span className="text-muted-foreground">Selisih penyesuaian:</span>
                <span
                  className={`font-semibold tabular-nums ${
                    selisih > 0
                      ? "text-success"
                      : selisih < 0
                        ? "text-danger"
                        : "text-muted-foreground"
                  }`}
                >
                  {selisih > 0 ? `+${selisih}` : selisih}
                </span>
              </div>
            </div>

            <Field>
              <FieldLabel htmlFor="stok_fisik">Stok Hasil Hitung Fisik *</FieldLabel>
              <Input
                id="stok_fisik"
                type="number"
                min="0"
                {...form.register("stok_fisik", { valueAsNumber: true })}
              />
              <FieldError errors={[form.formState.errors.stok_fisik]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="alasan">Alasan Penyesuaian *</FieldLabel>
              <Textarea
                id="alasan"
                rows={3}
                placeholder="Contoh: Stok opname bulanan, barang rusak, atau salah hitung penerimaan sebelumnya"
                {...form.register("alasan")}
              />
              <FieldError errors={[form.formState.errors.alasan]} />
            </Field>
          </FieldGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBuka(false)}
              disabled={loading}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Penyesuaian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
