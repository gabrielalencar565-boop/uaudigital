// Shown in every "Excluir tarefa?" confirmation: deleting is reversible for 30 days, and the way back is the Lixeira.
export function DeleteTrashNote({ className = "" }: { className?: string }) {
  return (
    <span className={`block text-muted-foreground ${className}`}>
      Ela vai para a Lixeira da Agenda e fica guardada por 30 dias. Se tiver publicações no Cronograma, o dia, o horário, a legenda
      e as capas ficam guardados e voltam junto ao <strong>Restaurar</strong>. Para trazer de volta, use sempre o Restaurar da Lixeira.
      Depois de 30 dias ela é apagada de vez.
    </span>
  );
}
