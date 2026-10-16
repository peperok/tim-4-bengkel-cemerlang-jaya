"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

const skemaPengguna = z.object({
  nama: z.string().trim().min(1, "Nama wajib diisi"),
  role: z.enum(["owner", "admin", "kepala_mekanik"]),
  aktif: z.boolean(),
});

type DataPengguna = z.infer<typeof skemaPengguna>;

export interface PenggunaItem {
  id: string;
  nama: string;
  email: string;
  role: "owner" | "admin" | "kepala_mekanik";
  aktif: boolean;
  created_at: string;
}

export function FormPengguna({
  pengguna,
  profilSayaId,
}: {
  pengguna: PenggunaItem;
  profilSayaId: string;
}) {
  const router = useRouter();
  const [buka, setBuka] = useState(false);
  const [loading, setLoading] = useState(false);

  const isDiriSendiri = pengguna.id === profilSayaId;

  const form = useForm<DataPengguna>({
    resolver: zodResolver(skemaPengguna),
    defaultValues: {
      nama: pengguna.nama,
      role: pengguna.role,
      aktif: pengguna.aktif,
    },
  });

  async function simpan(data: DataPengguna) {
    setLoading(true);
    const supabase = createClient();

    try {
      // Jika diri sendiri, jangan izinkan perubahan role atau status aktif
      const payload = isDiriSendiri
        ? { nama: data.nama }
        : {
            nama: data.nama,
            role: data.role,
            aktif: data.aktif,
          };

      const { error } = await supabase
        .from("profiles")
        .update(payload)
        .eq("id", pengguna.id);

      if (error) {
        toast.error("Gagal memperbarui pengguna: " + error.message);
        setLoading(false);
        return;
      }

      toast.success("Data pengguna berhasil diperbarui");
      setBuka(false);
      router.refresh();
    } catch (e: unknown) {
      toast.error("Terjadi kesalahan saat menyimpan data pengguna");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={buka}
      onOpenChange={(v) => {
        setBuka(v);
        if (!v) {
          form.reset({
            nama: pengguna.nama,
            role: pengguna.role,
            aktif: pengguna.aktif,
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Pencil className="size-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Pengguna</DialogTitle>
          <DialogDescription>
            Ubah nama, peran, dan status aktif untuk akun <strong>{pengguna.email}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(simpan)} className="space-y-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="nama">Nama Pengguna *</FieldLabel>
              <Input id="nama" {...form.register("nama")} />
              <FieldError errors={[form.formState.errors.nama]} />
            </Field>

            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" value={pengguna.email} disabled className="bg-muted text-muted-foreground" />
            </Field>

            <Field>
              <FieldLabel htmlFor="role">Peran</FieldLabel>
              <Controller
                control={form.control}
                name="role"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={isDiriSendiri}
                  >
                    <SelectTrigger id="role" className="w-full">
                      <SelectValue placeholder="Pilih Peran" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner (Pemilik)</SelectItem>
                      <SelectItem value="admin">Admin (Kasir/Meja Depan)</SelectItem>
                      <SelectItem value="kepala_mekanik">Kepala Mekanik</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {isDiriSendiri && (
                <p className="text-xs text-muted-foreground">
                  Anda tidak dapat mengubah peran akun Anda sendiri.
                </p>
              )}
              <FieldError errors={[form.formState.errors.role]} />
            </Field>

            <div className="flex items-center gap-3 pt-2">
              <Controller
                control={form.control}
                name="aktif"
                render={({ field }) => (
                  <Checkbox
                    id="aktif"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={isDiriSendiri}
                  />
                )}
              />
              <FieldLabel htmlFor="aktif" className="cursor-pointer text-sm font-medium">
                Akun Aktif (Dapat Login)
              </FieldLabel>
            </div>
            {isDiriSendiri && (
              <p className="text-xs text-muted-foreground">
                Anda tidak dapat menonaktifkan akun Anda sendiri.
              </p>
            )}
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
              {loading ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
