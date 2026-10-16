import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const DAFTAR_STATUS_WO = [
  "menunggu",
  "dikerjakan",
  "tertunda",
  "selesai",
  "siap_diambil",
  "diambil",
  "dibatalkan",
] as const;

export type StatusWO = (typeof DAFTAR_STATUS_WO)[number];

export const LABEL_STATUS_WO: Record<StatusWO, string> = {
  menunggu: "Menunggu",
  dikerjakan: "Dikerjakan",
  tertunda: "Tertunda",
  selesai: "Selesai Dikerjakan",
  siap_diambil: "Siap Diambil",
  diambil: "Diambil",
  dibatalkan: "Dibatalkan",
};

export const WARNA_STATUS_WO: Record<StatusWO, { bg: string; text: string; border: string }> = {
  menunggu: {
    bg: "bg-[#9E9E9E]/10",
    text: "text-[#616161]",
    border: "border-[#9E9E9E]/30",
  },
  dikerjakan: {
    bg: "bg-[#2196F3]/10",
    text: "text-[#1976D2]",
    border: "border-[#2196F3]/30",
  },
  tertunda: {
    bg: "bg-[#F59E0B]/10",
    text: "text-[#D97706]",
    border: "border-[#F59E0B]/30",
  },
  selesai: {
    bg: "bg-[#7E57C2]/10",
    text: "text-[#5E35B1]",
    border: "border-[#7E57C2]/30",
  },
  siap_diambil: {
    bg: "bg-[#4CAF50]/10",
    text: "text-[#2E7D32]",
    border: "border-[#4CAF50]/30",
  },
  diambil: {
    bg: "bg-[#2E7D32]/10",
    text: "text-[#1B5E20]",
    border: "border-[#2E7D32]/30",
  },
  dibatalkan: {
    bg: "bg-[#E53935]/10",
    text: "text-[#C62828]",
    border: "border-[#E53935]/30",
  },
};

export function BadgeStatusWO({ status, className }: { status: string; className?: string }) {
  const s = status as StatusWO;
  const cfg = WARNA_STATUS_WO[s] || {
    bg: "bg-muted",
    text: "text-muted-foreground",
    border: "border-border",
  };
  const label = LABEL_STATUS_WO[s] || status;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium", cfg.bg, cfg.text, cfg.border, className)}
    >
      {label}
    </Badge>
  );
}
