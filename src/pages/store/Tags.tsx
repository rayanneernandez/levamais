import { UserTagsManager } from "@/components/store/UserTagsManager";

export default function StoreTags() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tags de Usuários</h1>
        <p className="text-muted-foreground">
          Organize usuários com tags para segmentação de relatórios
        </p>
      </div>

      <UserTagsManager />

      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <h3 className="font-semibold text-sm">Como usar</h3>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>Crie tags como "Pista", "Loja", "Gerente", etc.</li>
          <li>Atribua tags aos usuários na tela de Usuários</li>
          <li>Use as tags para filtrar relatórios e análises</li>
        </ul>
      </div>
    </div>
  );
}