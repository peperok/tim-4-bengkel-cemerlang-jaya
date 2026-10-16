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

const skemaSparePart = z.object({
  nama: z.string().trim().min(1, "Nama spare part wajib diisi"),
  kode: z.string().trim().optional(),
  harga_jual: z.number().min(0, "Harga jual minimal 0"),
  stok_minimum: z.number().min(0, "Stok minimum minimal 0"),
  harga_modal: z.number().min(0, "Harga modal minimal 0").optional(),
});

type DataSparePart = z.infer<typeof skemaSparePart>;

export interface SparePartItem {
  id: string;
  kode: string;
  nama: string;
  stok: number;
  stok_minimum: number;
  harga_jual: number;
  inventory_costs?: { harga_modal: number } | null;
}

export function FormSparePart({
  item,
  isOwner,
}: {
  item?: SparePartItem;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<DataSparePart>({
    resolver: zodResolver(skemaSparePart),
    defaultValues: {
      nama: item?.nama ?? "",
      kode: item?.kode ?? "",
      harga_jual: item?.harga_jual ?? 0,
      stok_minimum: item?.stok_minimum ?? 5,
      harga_modal: item?.inventory_costs?.harga_modal ?? undefined,
    },
  });

  async function simpan(data: DataSparePart) {
    setLoading(true);
    const supabase = createClient();

    try {
      let itemId = item?.id;

      if (item) {
        // Mode Ubah
        const payloadUpdate = {
          nama: data.nama,
          kode: data.kode?.trim() || item.kode,
          harga_jual: data.harga_jual,
          stok_minimum: data.stok_minimum,
        };

        const { error: errUpdate } = await supabase
          .from("inventory_items")
          .update(payloadUpdate)
          .eq("id", item.id);

        if (errUpdate) {
          if (errUpdate.code === "23505") {
            form.setError("kode", { message: "Kode/SKU ini sudah digunakan" });
          } else {
            toast.error("Gagal memperbarui spare part: " + errUpdate.message);
          }
          setLoading(false);
          return;
        }
      } else {
        // Mode Tambah Baru (Stok awal = 0)
        const payloadInsert = {
          nama: data.nama,
          kode: data.kode?.trim() || "",
          harga_jual: data.harga_jual,
          stok_minimum: data.stok_minimum,
          jenis: "part",
          stok: 0,
        };

        const { data: itemBaru, error: errInsert } = await supabase
          .from("inventory_items")
          .insert(payloadInsert)
          .select("id")
          .single();

        if (errInsert) {
          if (errInsert.code === "23505") {
            form.setError("kode", { message: "Kode/SKU ini sudah digunakan" });
          } else {
            toast.error("Gagal menambahkan spare part: " + errInsert.message);
          }
          setLoading(false);
          return;
        }

        itemId = itemBaru.id;
      }

      // Jika pengguna adalah Owner dan mengisi harga modal
      if (isOwner && itemId && typeof data.harga_modal === "number" && !isNaN(data.harga_modal)) {
        const { error: errCost } = await supabase
          .from("inventory_costs")
          .upsert({
            item_id: itemId,
            harga_modal: data.harga_modal,
            updated_at: new Date().toISOString(),
          });

        if (errCost) {
          toast.error("Spare part tersimpan, namun harga modal gagal disimpan: " + errCost.message);
          setLoading(false);
          router.refresh();
          return;
        }
      }

      toast.success(item ? "Spare part berhasil diperbarui" : "Spare part berhasil ditambahkan");
      setBuka(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat menyimpan spare part");
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
        {item ? (
          <Button variant="outline" size="sm">
            <Pencil className="size-3.5" />
            Edit
          </Button>
        ) : (
          <Button>
            <Plus className="size-4" />
            Spare Part
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? "Ubah Spare Part" : "Tambah Spare Part"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(simpan)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nama">Nama Spare Part *</FieldLabel>
              <Input
                id="nama"
                placeholder="Contoh: Oli Mesin 4L"
                {...form.register("nama")}
              />
              <FieldError errors={[form.formState.errors.nama]} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="kode">Kode / SKU</FieldLabel>
                <Input
                  id="kode"
                  placeholder="Otomatis (SP-XXXX)"
                  {...form.register("kode")}
                />
                <FieldError errors={[form.formState.errors.kode]} />
              </Field>

              <Field>
                <FieldLabel htmlFor="stok_minimum">Stok Minimum</FieldLabel>
                <Input
                  id="stok_minimum"
                  type="number"
                  min="0"
                  {...form.register("stok_minimum", { valueAsNumber: true })}
                />
                <FieldError errors={[form.formState.errors.stok_minimum]} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="harga_jual">Harga Jual (Rp) *</FieldLabel>
                <Input
                  id="harga_jual"
                  type="number"
                  min="0"
                  {...form.register("harga_jual", { valueAsNumber: true })}
                />
                <FieldError errors={[form.formState.errors.harga_jual]} />
              </Field>

              {isOwner ? (
                <Field>
                  <FieldLabel htmlFor="harga_modal">Harga Modal (Rp) *</FieldLabel>
                  <Input
                    id="harga_modal"
                    type="number"
                    min="0"
                    placeholder="Khusus Owner"
                    {...form.register("harga_modal", { valueAsNumber: true })}
                  />
                  <FieldError errors={[form.formState.errors.harga_modal]} />
                </Field>
              ) : (
                <div className="flex flex-col justify-end pb-1 text-xs text-muted-foreground">
                  * Harga modal hanya dapat diisi dan dilihat oleh Owner.
                </div>
              )}
            </div>
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
