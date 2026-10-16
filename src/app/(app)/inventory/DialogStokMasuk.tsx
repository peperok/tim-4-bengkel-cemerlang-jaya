"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { PackagePlus } from "lucide-react";
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
import { createClient } from "@/lib/supabase/client";

const skemaStokMasuk = z.object({
  jumlah: z.number().min(1, "Jumlah minimal 1"),
  keterangan: z.string().trim().optional(),
});

type DataStokMasuk = z.infer<typeof skemaStokMasuk>;

export function DialogStokMasuk({
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

  const form = useForm<DataStokMasuk>({
    resolver: zodResolver(skemaStokMasuk),
    defaultValues: {
      jumlah: 1,
      keterangan: "",
    },
  });

  async function kirim(data: DataStokMasuk) {
    setLoading(true);
    const supabase = createClient();

    try {
      const { error } = await supabase.rpc("catat_stok_masuk", {
        p_item: itemId,
        p_jumlah: data.jumlah,
        p_keterangan: data.keterangan || undefined,
      });

      if (error) {
        toast.error("Gagal mencatat stok masuk: " + error.message);
        setLoading(false);
        return;
      }

      toast.success(`Berhasil menambah ${data.jumlah} stok untuk ${namaItem}`);
      setBuka(false);
      form.reset();
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat memproses stok masuk");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) form.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <PackagePlus className="size-3.5" />
          Stok Masuk
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catat Stok Masuk</DialogTitle>
          <DialogDescription>
            Menambah stok untuk <strong>{namaItem}</strong> (stok saat ini: {stokSekarang}).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(kirim)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="jumlah">Jumlah Masuk *</FieldLabel>
              <Input
                id="jumlah"
                type="number"
                min="1"
                {...form.register("jumlah", { valueAsNumber: true })}
              />
              <FieldError errors={[form.formState.errors.jumlah]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="keterangan">Keterangan</FieldLabel>
              <Input
                id="keterangan"
                placeholder="Contoh: Pembelian dari Toko Sinar"
                {...form.register("keterangan")}
              />
              <FieldError errors={[form.formState.errors.keterangan]} />
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
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
