import { redirect } from "next/navigation";

/**
 * Landing raíz — redirige al lobby del torneo activo.
 * El torneo activo se toma de NEXT_PUBLIC_TOURNAMENT_ID (env) o de un fallback.
 */
export default function HomePage() {
  const tid =
    process.env.NEXT_PUBLIC_TOURNAMENT_ID ?? process.env.NEXT_PUBLIC_DEFAULT_TID ?? "t-default";

  redirect(`/join/${tid}`);
}
