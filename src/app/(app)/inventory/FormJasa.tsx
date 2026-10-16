"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const skemaJasa = z.object({
  nama: z.string().trim().min(1, "Nama jasa wajib diisi"),
  kode: z.string().trim().optional(),
  harga_jual: z.number().min(0, "Tarif minimal 0"),
});

type DataJasa = z.infer<typeof skemaJasa>;

export interface JasaItem {
  id: string;
  kode: string;
  nama: string;
  harga_jual: number;
}

export function FormJasa({ jasa }: { jasa?: JasaItem }) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<DataJasa>({
    resolver: zodResolver(skemaJasa),
    defaultValues: {
      nama: jasa?.nama ?? "",
      kode: jasa?.kode ?? "",
      harga_jual: jasa?.harga_jual ?? 0,
    },
  });

  async function simpan(data: DataJasa) {
    setLoading(true);
    const supabase = createClient();

    try {
      if (jasa) {
        const payloadUpdate = {
          nama: data.nama,
          kode: data.kode?.trim() || jasa.kode,
          harga_jual: data.harga_jual,
        };

        const { error } = await supabase
          .from("inventory_items")
          .update(payloadUpdate)
          .eq("id", jasa.id);

        if (error) {
          if (error.code === "23505") {
            form.setError("kode", { message: "Kode jasa ini sudah digunakan" });
          } else {
            toast.error("Gagal memperbarui jasa: " + error.message);
          }
          setLoading(false);
          return;
        }
      } else {
        const payloadInsert = {
          nama: data.nama,
          kode: data.kode?.trim() || "",
          harga_jual: data.harga_jual,
          jenis: "jasa",
          stok: 0,
        };

        const { error } = await supabase.from("inventory_items").insert(payloadInsert);

        if (error) {
          if (error.code === "23505") {
            form.setError("kode", { message: "Kode jasa ini sudah digunakan" });
          } else {
            toast.error("Gagal menambahkan jasa: " + error.message);
          }
          setLoading(false);
          return;
        }
      }

      toast.success(jasa ? "Data jasa diperbarui" : "Jasa berhasil ditambahkan");
      setBuka(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat menyimpan data jasa");
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
        {jasa ? (
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Jasa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{jasa ? "Ubah Jasa" : "Tambah Jasa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(simpan)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nama_jasa">Nama Jasa *</FieldLabel>
              <Input
                id="nama_jasa"
                placeholder="Contoh: Ganti Oli"
                {...form.register("nama")}
              />
              <FieldError errors={[form.formState.errors.nama]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="kode_jasa">Kode Jasa</FieldLabel>
              <Input
                id="kode_jasa"
                placeholder="Otomatis (JS-XXXX)"
                {...form.register("kode")}
              />
              <FieldError errors={[form.formState.errors.kode]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="tarif">Tarif (Rp) *</FieldLabel>
              <Input
                id="tarif"
                type="number"
                min="0"
                {...form.register("harga_jual", { valueAsNumber: true })}
              />
              <FieldError errors={[form.formState.errors.harga_jual]} />
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
