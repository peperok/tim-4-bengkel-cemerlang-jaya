import { ambilProfilSaya } from "@/lib/profil";
import { DashboardClient } from "./DashboardClient";

export default async function Dashboard() {
  const profil = await ambilProfilSaya();
  return <DashboardClient peran={profil.peran} profilId={profil.id} />;
}
