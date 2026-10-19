import { logout } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";

/**
 * Bas de l'accueil : ferme la session de cet appareil et renvoie sur /login. Formulaire vers une
 * action serveur, pour la protection d'origine de Next. Taille par défaut du bouton : 44 px de
 * haut sous 768 px, comme tout contrôle de `main`.
 */
export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="ghost">
        Se déconnecter
      </Button>
    </form>
  );
}
