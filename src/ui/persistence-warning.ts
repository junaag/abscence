export function renderPersistenceWarning(visible: boolean): string {
  if (!visible) return '';
  return `
    <div class="persistence-warning" role="alert" data-testid="persistence-warning">
      <span aria-hidden="true">⚠️</span>
      <div>
        <strong>Sauvegarde locale indisponible</strong>
        <div>La partie continue sur cet écran, mais les dernières actions peuvent être perdues après fermeture ou rechargement.</div>
      </div>
    </div>
  `;
}
