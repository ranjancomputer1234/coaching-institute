/** Confirm soft-delete / archive of an admin record. */
export function confirmDelete(label: string) {
  return window.confirm(
    `Delete “${label}”? It will be archived and hidden from learners. You can filter for archived items later.`,
  );
}
